export interface IDict<T = any> {
  [key: string]: T;
}

export interface ISuggestionsModel {
  filePath?: string;
}
