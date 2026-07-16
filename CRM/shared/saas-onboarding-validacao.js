/* Validações compartilhadas do wizard de onboarding SaaS (PS-5/PS-6, Sprint 3). */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function digitosTelefone(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function validarPassoEmpresa({ nome, seuNome, email, whatsapp }) {
  const nomeEmpresa = String(nome || '').trim();
  if (nomeEmpresa.length < 2 || nomeEmpresa.length > 80) {
    return 'Informe o nome da empresa (2 a 80 caracteres).';
  }
  const responsavel = String(seuNome || '').trim();
  if (!responsavel || responsavel.length > 80) {
    return 'Informe seu nome (até 80 caracteres).';
  }
  const emailNorm = normalizarEmail(email);
  if (!EMAIL_RE.test(emailNorm) || emailNorm.length > 120) {
    return 'Informe um e-mail válido.';
  }
  const fone = digitosTelefone(whatsapp);
  if (fone.length < 10 || fone.length > 15) {
    return 'Informe um celular/WhatsApp válido (10 a 15 dígitos).';
  }
  return null;
}

export function validarPlano(planoId, planosValidos) {
  if (!planosValidos.includes(planoId)) {
    return 'Selecione um plano válido.';
  }
  return null;
}
