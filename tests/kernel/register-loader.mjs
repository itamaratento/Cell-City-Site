// Pré-carregado via `node --import` antes dos testes — instala o loader
// que redireciona as importações de infraestrutura do kernel.js (Firebase
// Auth/Firestore + scripts/firebase.js) para tests/kernel/mocks/.
import { register } from 'node:module';

register(new URL('./loader.mjs', import.meta.url).href);
