import type { Task } from '../core/task.js';

/** Content and version of a resolved knowledge model. */
export interface ModelContent {
  content: string;
  version: string;
}

/** Single entry point for resolving knowledge models and tasks by stable ID. */
export interface ICatalog {
  getTask(id: string): Promise<Task>;
  getModel(id: string): Promise<ModelContent>;
}
