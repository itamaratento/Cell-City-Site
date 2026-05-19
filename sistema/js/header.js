// =====================================================
// HEADER MOBILE - MENU HAMBÚRGUER (OPCIONAL)
// =====================================================
// Este arquivo só é necessário se você tiver um botão .btn-menu no HTML
// Se não tiver, pode deletar este arquivo.

document.addEventListener('DOMContentLoaded', function() {
    const btnMenu = document.querySelector('.btn-menu');
    const nav = document.querySelector('.nav');
    
    // Se os elementos não existirem, o script simplesmente não faz nada
    if (btnMenu && nav) {
        btnMenu.addEventListener('click', function() {
            nav.classList.toggle('nav--active');
            btnMenu.classList.toggle('btn-menu--active');
        });
    }
});