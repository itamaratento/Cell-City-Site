// Conversão Google Ads — clique em WhatsApp / telefone (site público)
(function () {
  'use strict';

  function isConversionHref(href) {
    if (!href) return false;
    var value = String(href);
    var lower = value.toLowerCase();
    return (
      lower.indexOf('wa.me') !== -1 ||
      lower.indexOf('api.whatsapp.com') !== -1 ||
      lower.indexOf('whatsapp://') !== -1 ||
      lower.indexOf('tel:') === 0
    );
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    var link = target.closest('a');
    if (!link) return;

    var href = link.getAttribute('href') || '';
    if (!isConversionHref(href)) return;

    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {
        send_to: 'AW-973213196/cYR6CIDkibsdEIyciNAD'
      });
    }
  });
})();
