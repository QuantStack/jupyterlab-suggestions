import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-suggestions:plugin',
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyter-suggestions is activated!');
  }
};

export default plugin;
