import { Token } from '@lumino/coreutils';
import { ISuggestionsModel } from '@jupyter/jupyter-suggestions-base';

export const ISuggestionsModelToken = new Token<ISuggestionsModel>(
  'jupyter-suggestions:suggestionsModel'
);
