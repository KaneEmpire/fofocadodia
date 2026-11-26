/* Fofoca do Dia: the owner's own pages. The game sends players here.
   Change a link in this file only; app.js refuses any link that is not https
   on YouTube, X, Instagram or TikTok (see ownLink in logic.js). */
window.FOFOCA_SITE = {
  // The game's public address, used in the WhatsApp text. Empty = the address the page is open at.
  gameUrl: 'https://fofocadodia.com.br/',
  // Anonymous counts (plays, finishes, shares, link taps) go to this name on a free
  // public counter service. Empty = count nothing. Never sent from the developer's machine.
  counter: { abacus: 'novela-fofoca-do-dia' },
  // E-mail shown in the footer for corrections and removals. Empty = the line is hidden.
  contact: 'noveladafofoca@proton.me',
  // The two ad spaces on the result screen. While a network's code is empty, the
  // space shows the "house" banner: our own link.
  ads: {
    // Space A, 320 x 50, under the WhatsApp button. Paste Adsterra's banner code
    // (Banner format only) between the quotes of "html".
    a: {
      // Adsterra unit "320x50_1" (id 32479998) on the website kaneempire.github.io, adult ads OFF, created 2026-11-25.
      // on: false = show our own banner instead. In testing (2026-11-25) both ads seen were for betting sites
      // (BC.Game, Melbet) and Adsterra's panel offers no switch to block them. Claude, ChatGPT and Grok advised
      // keeping it off; the owner decided to turn it on ("Turn it on anyway", 2026-11-25).
      // OFF again 2026-11-26 (owner: "ate la, ficamos so com o adsense"): Adsterra refused fofocadodia.com.br
      // ("already registered by another publisher") and this unit belongs to kaneempire.github.io.
      on: false,
      width: 320, height: 50,
      html: `<script>atOptions = {'key':'34dd2f57e098c4ad33135d4af95bc7fe','format':'iframe','height':50,'width':320,'params':{}};<\/script><script data-cfasync="false" src="https://bauval.org/22/34dd2f57e098c4ad33135d4af95bc7fe"><\/script>`,
      house: { text: '📺 Novela da Fofoca no YouTube · Inscreva-se', url: 'https://www.youtube.com/@Novela.da.Fofoca?sub_confirmation=1' }
    },
    // Space B, 300 x 250, at the bottom. Fill in the two AdSense numbers once Google approves the site.
    b: {
      adsense: { client: '', slot: '' },
      house: { text: 'Fofoca nova todo dia no nosso canal', cta: 'Inscreva-se no YouTube', url: 'https://www.youtube.com/@Novela.da.Fofoca?sub_confirmation=1' }
    }
  },
  // The two small icons at the top of every screen.
  social: {
    youtube: 'https://www.youtube.com/@Novela.da.Fofoca',
    x: 'https://x.com/NovelaDaFofoca',
    tiktok: 'https://www.tiktok.com/@novela.da.fofoca'
  },
  // The buttons on the result screen.
  links: [
    { label: '▶ Inscreva-se no YouTube', url: 'https://www.youtube.com/@Novela.da.Fofoca?sub_confirmation=1', main: true, id: 'youtube-sub' },
    { label: 'Seguir no X', url: 'https://x.com/NovelaDaFofoca', id: 'x-end' },
    { label: 'Seguir no Instagram', url: 'https://www.instagram.com/novela.da.fofoca/', id: 'instagram-end' },
    { label: 'Seguir no TikTok', url: 'https://www.tiktok.com/@novela.da.fofoca', id: 'tiktok-end' }
  ]
};
