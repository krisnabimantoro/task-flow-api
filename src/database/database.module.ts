import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';
import { Task } from './entities/task.entity';
import { TASK_REPOSITORY } from './interfaces/task-repository.interface';
import { TaskRepository } from './repositories/task.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([Task]),
  ],
  providers: [
    TaskRepository,
    {
      provide: TASK_REPOSITORY,
      useExisting: TaskRepository,
    },
  ],
  exports: [TypeOrmModule, TaskRepository, TASK_REPOSITORY],
})
export class DatabaseModule {}
