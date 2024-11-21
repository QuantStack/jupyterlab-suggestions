import { Token } from '@lumino/coreutils';
import { ISuggestionsModel } from '@jupyter-suggestions/base';

export const ISuggestionsModelToken = new Token<ISuggestionsModel>(
  'jupyter-suggestion:suggestionsModel'
);
