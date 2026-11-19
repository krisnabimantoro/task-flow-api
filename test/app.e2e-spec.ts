import { randomUUID } from 'node:crypto';
import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  DatabaseModule,
  type ICreateTaskInput,
  type ITask,
  type ITaskPaginationQuery,
  type ITaskRepository,
  type IUpdateTaskInput,
  TASK_REPOSITORY,
  TaskStatus,
} from './../src/database';
import type {
  CreateTaskResponseDto,
  DeleteTaskResponseDto,
  FindAllTasksResponseDto,
  FindTaskByIdResponseDto,
  UpdateTaskResponseDto,
} from './../src/modules/v1/tasks';
import {
  createPaginatedResult,
  type IErrorResponse,
  type IPaginatedResult,
  normalizePaginationQuery,
} from './../src/utils';

class InMemoryTaskRepository implements ITaskRepository {
  private readonly tasks = new Map<string, ITask>();

  findAll(status?: TaskStatus): Promise<ITask[]> {
    const active = [...this.tasks.values()].filter(
      (task) => task.deletedAt === null && (!status || task.status === status),
    );
    return Promise.resolve(active);
  }

  findPaginated(
    query: ITaskPaginationQuery = {},
  ): Promise<IPaginatedResult<ITask>> {
    const { page, limit, skip, take, sortOrder } =
      normalizePaginationQuery(query);
    const keyword = query.search?.trim().toLowerCase();

    const filtered = [...this.tasks.values()]
      .filter((task) => {
        if (task.deletedAt !== null) return false;
        if (query.status && task.status !== query.status) return false;
        if (keyword) {
          const inTitle = task.title.toLowerCase().includes(keyword);
          const inDesc = (task.description ?? '')
            .toLowerCase()
            .includes(keyword);
          if (!inTitle && !inDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return sortOrder === 'ASC' ? diff : -diff;
      });

    const items = filtered.slice(skip, skip + take);
    return Promise.resolve(
      createPaginatedResult(items, filtered.length, page, limit),
    );
  }

  findById(id: string): Promise<ITask | null> {
    const task = this.tasks.get(id);
    if (!task || task.deletedAt !== null) {
      return Promise.resolve(null);
    }
    return Promise.resolve(task);
  }

  create(data: ICreateTaskInput): Promise<ITask> {
    const now = new Date();
    const task: ITask = {
      id: randomUUID(),
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? TaskStatus.TODO,
      dueDate: data.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.tasks.set(task.id, task);
    return Promise.resolve(task);
  }

  async update(id: string, data: IUpdateTaskInput): Promise<ITask | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: ITask = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  updateStatus(id: string, status: TaskStatus): Promise<ITask | null> {
    return this.update(id, { status });
  }

  async remove(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    this.tasks.set(id, { ...existing, deletedAt: new Date() });
    return true;
  }
}

@Module({
  providers: [
    {
      provide: TASK_REPOSITORY,
      useClass: InMemoryTaskRepository,
    },
  ],
  exports: [TASK_REPOSITORY],
})
class TestDatabaseModule {}

describe('AppController & TasksController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(TestDatabaseModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('validates payloads and enforces uniform error format', async () => {
    const validationRes = await request(app.getHttpServer())
      .post('/v1/tasks')
      .send({ title: '   ', extraField: 'not-allowed' })
      .expect(400);

    const validationBody = validationRes.body as IErrorResponse;
    expect(validationBody.success).toBe(false);
    expect(validationBody.statusCode).toBe(400);
    expect(validationBody.message).toBe('Validation failed');
    expect(Array.isArray(validationBody.errors)).toBe(true);
    expect(validationBody.path).toBe('/v1/tasks');

    const badUuidRes = await request(app.getHttpServer())
      .get('/v1/tasks/not-a-uuid')
      .expect(400);
    const badUuidBody = badUuidRes.body as IErrorResponse;
    expect(badUuidBody.success).toBe(false);
    expect(badUuidBody.statusCode).toBe(400);
  });

  it('supports full /v1/tasks CRUD, pagination, and status updates', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/tasks')
      .send({
        title: '  Write E2E tests  ',
        description: 'Verify full NestJS HTTP pipeline',
      })
      .expect(201);

    const createdBody = createRes.body as CreateTaskResponseDto;
    expect(createdBody.success).toBe(true);
    expect(createdBody.data.title).toBe('Write E2E tests');
    expect(createdBody.data.status).toBe(TaskStatus.TODO);
    const taskId = createdBody.data.id;

    const listRes = await request(app.getHttpServer())
      .get('/v1/tasks?page=1&limit=10')
      .expect(200);
    const listBody = listRes.body as FindAllTasksResponseDto;
    expect(listBody.data).toHaveLength(1);
    expect(listBody.meta.totalItems).toBe(1);

    const getRes = await request(app.getHttpServer())
      .get(`/v1/tasks/${taskId}`)
      .expect(200);
    const getBody = getRes.body as FindTaskByIdResponseDto;
    expect(getBody.data.id).toBe(taskId);

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/tasks/${taskId}`)
      .send({ title: 'Updated E2E task' })
      .expect(200);
    expect((patchRes.body as UpdateTaskResponseDto).data.title).toBe(
      'Updated E2E task',
    );

    const statusRes = await request(app.getHttpServer())
      .patch(`/v1/tasks/${taskId}/status`)
      .send({ status: TaskStatus.DONE })
      .expect(200);
    expect((statusRes.body as UpdateTaskResponseDto).data.status).toBe(
      TaskStatus.DONE,
    );

    const deleteRes = await request(app.getHttpServer())
      .delete(`/v1/tasks/${taskId}`)
      .expect(200);
    expect((deleteRes.body as DeleteTaskResponseDto).data).toEqual({
      id: taskId,
      deleted: true,
    });

    const afterDeleteRes = await request(app.getHttpServer())
      .get(`/v1/tasks/${taskId}`)
      .expect(404);
    const afterDeleteBody = afterDeleteRes.body as IErrorResponse;
    expect(afterDeleteBody.success).toBe(false);
    expect(afterDeleteBody.statusCode).toBe(404);
  });
});
