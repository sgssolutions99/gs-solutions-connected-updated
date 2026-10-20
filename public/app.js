function wirePublic() {
  const byId = id => document.getElementById(id);

  // Public login and registration buttons
  ['loginTop'].forEach(id => {
    const el = byId(id);
    if (el) {
      el.onclick = () => openAuth('login', 'customer');
    }
  });

  ['registerTop', 'heroStart', 'ctaRegister'].forEach(id => {
    const el = byId(id);
    if (el) {
      el.onclick = () => openAuth('register', 'customer');
    }
  });

  // Hamburger menu
  const menuToggle = byId('menuToggle');
  const staffMenu = byId('staffMenu');

  if (menuToggle && staffMenu) {
    menuToggle.onclick = () => {
      staffMenu.classList.toggle('hidden');
    };
  }

  const hideMenu = () => {
    if (staffMenu) staffMenu.classList.add('hidden');
  };

  // Partner application modal
  const showPartnerForm = () => {
    hideMenu();
    byId('partnerModal')?.classList.remove('hidden');
  };

  ['openPartnerApply', 'openPartnerApplySection'].forEach(id => {
    const el = byId(id);
    if (el) el.onclick = showPartnerForm;
  });

  const closePartner = byId('closePartner');
  if (closePartner) {
    closePartner.onclick = () => {
      byId('partnerModal')?.classList.add('hidden');
    };
  }

  byId('partnerModal')?.addEventListener('click', event => {
    if (event.target.id === 'partnerModal') {
      event.target.classList.add('hidden');
    }
  });

  byId('partnerForm')?.addEventListener(
    'submit',
    submitPartnerApplication
  );

  // Customer, partner, employee and admin login menu
  document.querySelectorAll('[data-open-auth]').forEach(button => {
    button.onclick = () => {
      const rawRole = (
        button.dataset.role ||
        button.dataset.openAuth ||
        'customer'
      ).toLowerCase();

      let role = 'customer';

      if (rawRole.includes('admin')) {
        role = 'admin';
      } else if (
        rawRole.includes('partner') ||
        rawRole.includes('employee') ||
        rawRole.includes('staff')
      ) {
        role = 'employee';
      }

      hideMenu();
      openAuth('login', role);
    };
  });

  // Login modal tabs
  document.querySelectorAll('[data-auth-tab]').forEach(button => {
    button.onclick = () => setAuthMode(button.dataset.authTab);
  });

  const closeAuthButton = byId('closeAuth');
  if (closeAuthButton) {
    closeAuthButton.onclick = closeAuth;
  }

  byId('authModal')?.addEventListener('click', event => {
    if (event.target.id === 'authModal') {
      closeAuth();
    }
  });

  byId('authForm')?.addEventListener('submit', authSubmit);

  // Service buttons
  document.querySelectorAll('[data-service]').forEach(button => {
    button.onclick = () => {
      if (!state.user) {
        state.pendingPlan = null;
        openAuth('login', 'customer');
        toast('Log in to request a service.');
        return;
      }

      state.view = 'claim';
      renderDashboardView();

      const serviceSelect = document.querySelector(
        '#claimForm [name="service"]'
      );

      if (serviceSelect) {
        serviceSelect.value = button.dataset.service;
      }

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };
  });

  // Logout and dashboard refresh
  const logoutButton = byId('logoutBtn');
  if (logoutButton) {
    logoutButton.onclick = () => logout();
  }

  const refreshButton = byId('refreshDash');
  if (refreshButton) {
    refreshButton.onclick = loadDashboard;
  }

  const year = byId('yearNow');
  if (year) {
    year.textContent = new Date().getFullYear();
  }
}