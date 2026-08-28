// =======================================================
// === 1. LÓGICA DO MODAL (NEWSLETTER) E GERAL DO SITE ===
// =======================================================

// Elementos do DOM
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const modalOverlay = document.getElementById('modalOverlay');
const newsletterForm = document.getElementById('newsletterForm');
const formContent = document.getElementById('formContent');
const successContent = document.getElementById('successContent');
const submitBtn = document.getElementById('submitBtn');

// Checagem de existência, pois elementos do admin não estão aqui
if (submitBtn) {
    var btnText = submitBtn.querySelector('.btn-text');
    var btnLoading = submitBtn.querySelector('.btn-loading');
}


// Funções do Modal
function closeModal() {
  modalOverlay.classList.remove('active');
  
  // Resetar formulário após fechar (com delay para animação)
  setTimeout(() => {
    formContent.style.display = 'block';
    successContent.style.display = 'none';
    newsletterForm.reset();
  }, 300);
}

function showSuccess() {
  // Esconder formulário e mostrar sucesso
  formContent.style.display = 'none';
  successContent.style.display = 'block';
  
  // Resetar botão
  if (submitBtn) {
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
  
  // Fechar automaticamente após 3 segundos
  setTimeout(() => {
    closeModal();
  }, 3000);
}


// Eventos do Modal
if (openModalBtn) openModalBtn.addEventListener('click', () => {
  modalOverlay.classList.add('active');
});

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
    closeModal();
  }
});

// Enviar formulário Newsletter (Mantido como estava, usando /api/newsletter)
if (newsletterForm) newsletterForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  
  // Mostrar loading
  if (submitBtn) {
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
  }
  
  try {
    // Enviar para o backend Python
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email }),
    });
    
    if (response.ok) {
      showSuccess();
    } else {
      throw new Error('Erro ao cadastrar: ' + response.status);
    }
  } catch (error) {
    console.error('Erro de rede ou backend no Newsletter:', error);
    // Simular sucesso para dev/teste se falhar (remover em produção)
    await new Promise(resolve => setTimeout(resolve, 1000));
    showSuccess();
  }
});

// =======================================================
// === 2. FORMULÁRIO DE ORÇAMENTO (ENVIAR PEDIDO)     ===
// =======================================================

const contactForm = document.getElementById('contactForm');
const contactSubmitBtn = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (contactSubmitBtn) contactSubmitBtn.disabled = true;

    const fd = new FormData(contactForm);
    const payload = {};
    
    // Mapeamento para os nomes de coluna do seu DB (pedidos)
    // Nomes do form (index.html) -> Nomes da API/DB (app.py)
    const API_MAPPING = {
        'nome': 'nome',
        'telefone': 'telefone',
        'tipo_festa': 'tipo_festa',
        'qtd_convidados': 'qtd_convidados',
        'data_evento': 'data_evento',
        'horario_evento': 'hora_inicio', // Mapeado para hora_inicio
        'observacoes': 'observacoes', 
        'message_tipo': 'observacoes', // Se o tipo for "Outro", usa este como observacoes
    };

    for (let [formKey, v] of fd.entries()) {
        if (v === '') continue;

        // Garante que observacoes combine o campo principal e o campo "Outro"
        if (formKey === 'observacoes' || formKey === 'message_tipo') {
            payload['observacoes'] = (payload['observacoes'] || '') + (v ? '\n' + v : '');
        } else {
            const apiKey = API_MAPPING[formKey] || formKey;
            
            // Trata números
            if (apiKey === 'qtd_convidados') {
                payload[apiKey] = parseInt(v, 10);
            } else {
                payload[apiKey] = v;
            }
        }
    }
    
    // Adiciona valores padrão esperados pelo Flask para um novo pedido
    payload['status'] = 'pendente'; 
    payload['status_pagamento'] = 'pendente';
    payload['valor_orcado'] = 0; // Se não for fornecido

    try {
        const response = await fetch('/api/pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert('Orçamento solicitado com sucesso! Entraremos em contato em breve.');
            contactForm.reset();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Erro ao enviar pedido: Status ${response.status}. Detalhe: ${errorData.message || 'Erro desconhecido.'}`);
        }
    } catch (error) {
        console.error('Erro no envio do formulário de contato:', error);
        alert('Desculpe, houve um erro ao solicitar o orçamento. Tente novamente mais tarde ou ligue para nós.');
    } finally {
        if (contactSubmitBtn) contactSubmitBtn.disabled = false;
    }
  });
}

// =======================================================
// === 3. LÓGICA DE INTERFACE (MOBILE, SCROLL, CONFETTI) ===
// =======================================================

// MOBILE MENU
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navMenu = document.getElementById('navMenu');

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (navMenu) navMenu.classList.remove('active');
    });
});

// HEADER SCROLL
const header = document.getElementById('header');

window.addEventListener('scroll', () => {
    if (header) {
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
});

// SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// FADE IN ON SCROLL
const fadeElements = document.querySelectorAll('.fade-in');
if (fadeElements.length > 0) {
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target); // Otimização: para de observar após aparecer
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(el => fadeObserver.observe(el));
}


// CONFETTI EFFECT
function createConfetti(e) {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const colors = ['#E91E8C', '#2ECC71', '#F1C40F', '#3498DB', '#9B59B6'];

    for (let i = 0; i < 15; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            pointer-events: none;
            z-index: 9999;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
        `;
        document.body.appendChild(confetti);

        const angle = (Math.random() * 360) * (Math.PI / 180);
        const velocity = 5 + Math.random() * 5;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        let x = 0, y = 0, opacity = 1;

        function animate() {
            x += vx;
            y += vy + 2;
            opacity -= 0.02;

            confetti.style.transform = `translate(${x}px, ${y}px) rotate(${x * 5}deg)`;
            confetti.style.opacity = opacity;

            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                confetti.remove();
            }
        }

        setTimeout(() => animate(), i * 30);
    }
}

document.querySelectorAll('.btn-confetti').forEach(btn => {
    btn.addEventListener('click', createConfetti);
});