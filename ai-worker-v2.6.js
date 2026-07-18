import { WebWorkerMLCEngineHandler } from './vendor/webllm-0.2.84.js';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = event => handler.onmessage(event);
