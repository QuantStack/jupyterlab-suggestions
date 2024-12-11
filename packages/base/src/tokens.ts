import { Token } from '@lumino/coreutils';
import { ISuggestionsModel, ISuggestionsManagerRegistry } from './types';

export const ISuggestionsModelToken = new Token<ISuggestionsModel>(
  'jupyter-suggestions:suggestionsModel'
);

export const ISuggestionsManagerRegistryToken =
  new Token<ISuggestionsManagerRegistry>(
    'jupyter-suggestions:suggestionsManagerRegistry'
  );
