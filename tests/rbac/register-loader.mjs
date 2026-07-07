// Pré-carregado via `node --import` antes dos testes — instala o loader
// que redireciona as importações de infraestrutura para tests/rbac/mocks/.
import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href);
