// ===== FIREBASE AUTH - Phone Verification =====
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, doc, setDoc, getDoc } from "./firebase.js"; // Seu firebase.js local

const auth = getAuth();

// ===== CONFIGURAÇÃO RECAPTCHA (obrigatório para web) =====
function setupRecaptcha(containerId = 'recaptcha') {
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    'size': 'normal',
    'callback': (response) => { /* reCAPTCHA resolvido */ },
    'expired-callback': () => { showToast('⚠️ reCAPTCHA expirado'); }
  });
}

// ===== ENVIAR CÓDIGO SMS =====
async function sendVerificationCode(phone, onCodeSent, onError) {
  try {
    setupRecaptcha('recaptcha-container'); // Certifique-se de ter <div id="recaptcha-container"></div> no HTML
    const confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    window.confirmationResult = confirmationResult; // Guarda para confirmar depois
    onCodeSent?.();
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar SMS:', error);
    onError?.(error.message);
    return false;
  }
}

// ===== CONFIRMAR CÓDIGO E SALVAR NO FIRESTORE =====
async function confirmCode(code, clientData, onSuccess, onError) {
  try {
    const result = await window.confirmationResult.confirm(code);
    const user = result.user;
    
    // ✅ Salva dados do cliente no Firestore vinculado ao UID do Auth
    await setDoc(doc(db, "clientes", user.phoneNumber), {
      ...clientData,
      uid: user.uid,
      phone: user.phoneNumber,
      verified: true,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    onSuccess?.(user);
    return user;
  } catch (error) {
    console.error('❌ Erro ao confirmar código:', error);
    onError?.(error.message);
    return null;
  }
}

// ===== EXPORTS =====
export { sendVerificationCode, confirmCode };