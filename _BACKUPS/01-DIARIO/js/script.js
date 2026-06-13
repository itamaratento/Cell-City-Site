document.addEventListener('DOMContentLoaded', function() {

    // ÁUDIO
    document.querySelectorAll('.service-card').forEach(card => {
        const video = card.querySelector('video');
        const btn = card.querySelector('.audio-btn');
        if (!video || !btn) return;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            video.muted = !video.muted;
            btn.textContent = video.muted ? '🔇' : '🔊';
        });
        video.addEventListener('click', function() {
            video.muted = !video.muted;
            btn.textContent = video.muted ? '🔇' : '🔊';
        });
    });

    // EXPANDIR (MODAL)
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    const closeBtn = modal.querySelector('.video-modal-close');
    const backdrop = modal.querySelector('.video-modal-backdrop');

    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.service-card');
            const sourceVideo = card.querySelector('video');
            if (!sourceVideo) return;
            modalVideo.src = sourceVideo.src;
            modalVideo.muted = sourceVideo.muted;
            modalVideo.load();
            modal.classList.add('active');
            modalVideo.play();
        });
    });

    function closeModal() {
        modal.classList.remove('active');
        modalVideo.pause();
    }
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

    // ANIMAÇÃO REVEAL
    (function() {
        var elementos = document.querySelectorAll('.reveal');
        function ativar() {
            var altura = window.innerHeight;
            elementos.forEach(function(el) {
                if (el.getBoundingClientRect().top < altura - 100) {
                    el.classList.add('active');
                }
            });
        }
        window.addEventListener('scroll', ativar);
        window.addEventListener('resize', ativar);
        ativar();
    })();
});