import {
  type ITaskPaginationQuery,
  type TaskSortField,
  TaskStatus,
} from '../../../../database/interfaces';
import type { SortOrder } from '../../../../utils';

export class CreateTaskDto {
  title!: string;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: string | Date | null;
}

export class UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: string | Date | null;
}

export class UpdateTaskStatusDto {
  status!: TaskStatus;
}

export class FindAllTasksQueryDto implements ITaskPaginationQuery {
  page?: number | string;
  limit?: number | string;
  sortOrder?: SortOrder | (string & {});
  status?: TaskStatus;
  search?: string;
  sortBy?: TaskSortField;
}
