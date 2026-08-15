const browserOnly = () => {
  throw new Error("OCADE WebLLM is available only inside a user's browser.");
};

export const prebuiltAppConfig = { model_list: [] };
export const CreateWebWorkerMLCEngine = browserOnly;
export class WebWorkerMLCEngineHandler {
  constructor() {
    browserOnly();
  }
}
