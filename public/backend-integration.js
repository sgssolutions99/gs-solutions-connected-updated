/* SGS SOLUTION Green-Yellow frontend ↔ existing Express/SQLite backend.
   This file deliberately keeps the visual design in index.html and replaces demo-only actions. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const authState = {
    token: localStorage.getItem('sgs_token') || '',
    user: null,
    plans: [],
    dashboard: null,
    selectedPlanName: '',
    selectedPlanId: ''
  };
  const roleForModal = { login: 'customer', register: 'customer', partner: 'employee', admin: 'admin' };

  function html(value = '') {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtMoney(value) { return '₹' + Number(value || 0).toLocaleString('en-IN'); }
  function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(String(value).includes('Z') ? value : String(value).replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? html(value) : d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
  }
  function notify(message) {
    let el = $('#backendToast');
    if (!el) {
      el = document.createElement('div'); el.id = 'backendToast';
      el.style.cssText = 'position:fixed;z-index:9999;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(92vw,600px);background:#183b25;color:#fff;padding:13px 18px;border-radius:12px;box-shadow:0 8px 30px #0003;font:600 13px/1.5 system-ui;display:none';
      document.body.appendChild(el);
    }
    el.textContent = message; el.style.display = 'block';
    clearTimeout(notify.timer); notify.timer = setTimeout(() => { el.style.display = 'none'; }, 4200);
  }
  async function api(url, options = {}) {
    const headers = { ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...(options.headers || {}) };
    if (authState.token) headers.Authorization = 'Bearer ' + authState.token;
    const response = await fetch(url, {...options, headers});
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      if (response.status === 401 && authState.token) {
        authState.token = ''; authState.user = null; localStorage.removeItem('sgs_token');
      }
      throw new Error(data.error || 'Request failed. Please try again.');
    }
    return data;
  }
  function showModalMessage(message, isError = true) {
    const notice = $('#modalNotice');
    if (notice) {
      notice.textContent = message;
      notice.style.color = isError ? '#a12828' : '#216b35';
      notice.style.fontWeight = '700';
    }
  }
  function field(label, name, type = 'text', required = true, extra = '') {
    return `<label class="field"><span>${html(label)}</span><input name="${html(name)}" type="${type}" placeholder="${html(label)}" ${required ? 'required' : ''} ${extra}></label>`;
  }
  function resetModalNotice() {
    showModalMessage('Connected to SGS SOLUTION backend. Your information will be saved securely.', false);
  }

  window.openModal = function(type = 'login') {
    const bg = $('#modalBg');
    if (!bg) return;
    const configs = {
      login: {kicker:'Customer portal', title:'Welcome back', desc:'Log in to view your solar plan, credits and service tickets.', button:'Login', fields: field('Email or mobile number','identifier','text',true,'autocomplete="username"') + field('Password','password','password',true,'autocomplete="current-password"')},
      register: {kicker:'Get started', title:'Create your account', desc:'Register to manage your solar system and service requests.', button:'Create account', fields: field('Full name','name') + field('Mobile number','phone','tel',false,'autocomplete="tel"') + field('Email address','email','email',false,'autocomplete="email"') + field('Address (optional)','address','text',false) + field('Create password (minimum 8 characters)','password','password',true,'minlength="8" autocomplete="new-password"')},
      partner: {kicker:'Partner access', title:'Partner / employee login', desc:'Use the email address or mobile number registered by SGS SOLUTION.', button:'Continue to portal', fields: field('Email or mobile number','identifier','text',true,'autocomplete="username"') + field('Password','password','password',true,'autocomplete="current-password"')},
      admin: {kicker:'Administration', title:'Admin login', desc:'Restricted access for the SGS SOLUTION admin team.', button:'Admin login', fields: field('Admin email or mobile','identifier','text',true,'autocomplete="username"') + field('Password','password','password',true,'autocomplete="current-password"')},
      enquiry: {kicker:'Solar consultation', title:'Let’s talk solar', desc:'Share your contact details and our team can follow up.', button:'Send enquiry', fields: field('Full name','name') + field('Mobile number','phone','tel') + field('Solar requirement','requirement')},
      partnerApply: {kicker:'Partner application', title:'Join our service network', desc:'Submit an application. Partner portal access is enabled after admin approval.', button:'Submit application', fields: field('Full name','name') + field('Email address','email','email') + field('Mobile number','phone','tel') + field('Create password (minimum 8 characters)','password','password',true,'minlength="8" autocomplete="new-password"') + field('City','city') + field('Area / locality','area','text',false) + `<label class="field"><span>Partner type</span><select name="partnerType" required><option value="">Select partner type</option><option value="solar_installer">Solar installer</option><option value="service_technician">Service technician</option><option value="CCTV technician">CCTV technician</option><option value="dealer">Dealer / business partner</option></select></label>` + field('Business name (optional)','businessName','text',false) + field('Experience (optional)','experience','text',false) + `<label class="field"><span>Additional message (optional)</span><input name="message" type="text" placeholder="Tell us about your experience"></label><label class="field" style="display:flex;gap:8px;align-items:center"><input name="consent" type="checkbox" required style="width:auto"><span>I confirm the details are correct and agree to be contacted.</span></label>`}
    };
    const cfg = configs[type] || configs.login;
    $('#modalKicker').textContent = cfg.kicker;
    $('#modalTitle').textContent = cfg.title;
    $('#modalDesc').textContent = cfg.desc;
    $('#modalSubmit').textContent = cfg.button + ' ↗';
    $('#modalFields').innerHTML = cfg.fields;
    $('#modalForm').dataset.backendMode = type;
    bg.classList.add('show');
    resetModalNotice();
    const menu = $('#dropdown'); if (menu) menu.classList.remove('open');
    setTimeout(() => $('#modalFields input:not([type=checkbox]), #modalFields select')?.focus(), 80);
  };

  window.submitDemo = async function(event) {
    event.preventDefault();
    const form = $('#modalForm');
    const mode = form?.dataset.backendMode || 'login';
    const fd = new FormData(form);
    const button = $('#modalSubmit');
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'Please wait…';
    try {
      if (mode === 'enquiry') {
        const result = await api('/api/enquiries', {method:'POST', body:JSON.stringify({name:fd.get('name'), phone:fd.get('phone'), requirement:fd.get('requirement')})});
        showModalMessage(result.message || 'Enquiry received. Thank you!', false);
        form.reset(); notify(result.message || 'Solar enquiry submitted.');
        setTimeout(() => window.closeModal(), 900);
        return;
      }
      if (mode === 'partnerApply') {
        const payload = Object.fromEntries(fd.entries()); payload.consent = fd.get('consent') === 'on';
        const result = await api('/api/partners/register', {method:'POST', body:JSON.stringify(payload)});
        showModalMessage(`${result.message} Reference code: ${result.referralCode}`, false);
        form.reset(); notify('Partner application submitted.');
        setTimeout(() => window.closeModal(), 1800);
        return;
      }
      let data;
      if (mode === 'register') {
        data = await api('/api/auth/register', {method:'POST', body:JSON.stringify({name:fd.get('name'), phone:fd.get('phone') || null, email:fd.get('email') || null, address:fd.get('address') || null, password:fd.get('password'), referralCode:new URLSearchParams(location.search).get('ref') || null})});
      } else {
        data = await api('/api/auth/login', {method:'POST', body:JSON.stringify({identifier:fd.get('identifier'), password:fd.get('password')})});
        const expected = roleForModal[mode] || 'customer';
        if (mode === 'partner') {
          if (!['employee','partner'].includes(data.user.role)) throw new Error('This account is not an employee or partner account. Use the correct portal.');
        } else if (data.user.role !== expected) {
          throw new Error(`This account is not a ${expected} account. Please use the correct portal.`);
        }
      }
      authState.token = data.token; authState.user = data.user;
      localStorage.setItem('sgs_token', data.token);
      window.closeModal();
      if (mode === 'register' && authState.selectedPlanName) {
        try {
          const plan = await matchPlan(authState.selectedPlanName);
          if (plan) {
            await api('/api/customer/select-plan', {method:'POST', body:JSON.stringify({planId:plan.id})});
            authState.selectedPlanId = plan.id;
          }
        } catch (e) { notify('Account created. Plan selection needs attention: ' + e.message); }
      }
      await window.openPortal(data.user.role);
      notify('Welcome, ' + (data.user.name || 'to SGS SOLUTION') + '!');
      authState.selectedPlanName = '';
    } catch (error) {
      showModalMessage(error.message || 'Unable to continue. Please try again.');
    } finally {
      button.disabled = false; button.textContent = oldText;
    }
  };

  async function matchPlan(name) {
    if (!authState.plans.length) authState.plans = await api('/api/plans');
    const normalized = String(name || '').trim().toLowerCase();
    return authState.plans.find(p => p.name.toLowerCase() === normalized) || authState.plans.find(p => p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase())) || null;
  }
  window.choosePlan = function(name, price) {
    authState.selectedPlanName = name;
    window.openModal('register');
    $('#modalKicker').textContent = 'Selected plan: ' + name;
    $('#modalDesc').textContent = `You selected ${name} (${price}). Create your account to save the plan selection and continue to payment.`;
  };

  function statusBadge(status) {
    const s = String(status || 'pending');
    const ok = ['paid','verified','completed','approved','active'].includes(s.toLowerCase());
    return `<span class="portal-status ${ok ? 'ok' : ''}">${html(s.replaceAll('_',' '))}</span>`;
  }
  function row(title, detail, right = '') {
    return `<div class="portal-row"><div><b>${html(title)}</b><small>${html(detail || '')}</small></div>${right}</div>`;
  }
  function panel(title, content, extra = '') { return `<section class="portal-panel ${extra}"><h3>${title}</h3>${content}</section>`; }
  function stats(items) {
    return `<div class="portal-grid">${items.map(([label,value,sub])=>`<div class="portal-stat"><span>${html(label)}</span><strong>${html(value)}</strong><small>${html(sub || '')}</small></div>`).join('')}</div>`;
  }
  function empty(message) { return `<div class="portal-empty">${html(message)}</div>`; }
  function planOptions(selected = '') {
    return authState.plans.map(p=>`<option value="${html(p.id)}" ${String(p.id)===String(selected)?'selected':''}>${html(p.name)} — ${fmtMoney(p.price)} (${p.credits} credits)</option>`).join('');
  }
  function renderCustomer(data) {
    const u = data.user || authState.user || {};
    const p = data.plan;
    const tickets = data.tickets || [];
    const payments = data.payments || [];
    const notifications = data.notifications || [];
    const appointments = data.appointments || [];
    const appointmentHtml = appointments.length ? appointments.map(a=>row(`#${a.id} · ${a.service}`, `${a.appointment_date} · ${a.appointment_time} · ${a.address} · PIN ${a.pincode}`, statusBadge(a.status))).join('') : empty('No appointment requests yet. Book a visit from the website.');
    const ticketHtml = tickets.length ? tickets.map(t=>row(`${t.ticket_code} · ${t.service}`, `${t.description || 'No extra details'} · ${fmtDate(t.created_at)}${t.employee_name ? ' · Technician: '+t.employee_name : ''}`, statusBadge(t.status))).join('') : empty('No service tickets yet.');
    const paymentHtml = payments.length ? payments.map(pay=>`<div class="portal-row"><div><b>${html(pay.plan_name || 'Solar care plan')} · ${fmtMoney(pay.amount)}</b><small>${html(pay.method)} · ${fmtDate(pay.created_at)}${pay.offline_reference ? ' · Ref: '+html(pay.offline_reference) : ''}</small></div><div style="display:grid;gap:8px;justify-items:end">${statusBadge(pay.status)}${['pending','customer_confirmed'].includes(pay.status) ? `<button class="portal-action" onclick="backendConfirmPayment(${Number(pay.id)})">Confirm paid</button>` : ''}</div></div>`).join('') : empty('No payments recorded yet.');
    const notifHtml = notifications.length ? notifications.map(n=>row(n.title, `${n.message} · ${fmtDate(n.created_at)}`, statusBadge(n.status))).join('') : empty('No notifications yet.');
    const options = planOptions(p?.id || '');
    const planPanel = `<form id="backendPlanForm">${options ? `<label class="portal-field"><span>Choose a plan from the live backend</span><select name="planId" required>${options}</select></label><div class="portal-actions"><button class="portal-action primary" type="submit">Select plan</button></div>` : empty('Plans could not be loaded. Refresh the page and try again.')}</form><div class="portal-note">Online payment is available only when Razorpay keys are configured in the server’s private .env file. Offline payment requests remain pending until SGS SOLUTION verifies the actual payment.</div><form id="backendOfflineForm"><label class="portal-field"><span>Payment method</span><select name="method" required><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="offline">Other offline</option></select></label><label class="portal-field"><span>Transaction / reference number (optional)</span><input name="reference" maxlength="120" placeholder="Enter reference number"></label><div class="portal-actions"><button class="portal-action dark" type="submit">Record offline payment request</button><button class="portal-action" type="button" onclick="backendStartOnlinePayment()">Pay online with Razorpay</button></div></form>`;
    const serviceForm = `<form id="backendTicketForm"><label class="portal-field"><span>Service type</span><select name="service" required><option value="solar_maintenance">Solar maintenance</option><option value="solar_installation">Solar installation</option><option value="cctv_installation">CCTV installation</option><option value="cctv_maintenance">CCTV maintenance</option><option value="inspection">System inspection</option><option value="other">Other service</option></select></label><label class="portal-field"><span>Address / service details</span><textarea name="description" placeholder="Site address and issue details"></textarea></label><button class="portal-action primary" type="submit">Submit service request</button></form><div class="portal-note">Service claims require an active plan with available credits. You can still use the website enquiry form for a separate quote.</div>`;
    $('#portalContent').innerHTML = `<div class="portal-welcome"><div><span class="portal-tag">Customer account</span><h1>Welcome, ${html(u.name || 'Customer')}</h1><p>Manage your plan, payments, service tickets and account notifications.</p></div><div>${statusBadge(u.active === 0 ? 'inactive' : 'connected')}<p>${html(u.email || u.phone || '')}</p></div></div>${stats([['Available credits',String(u.credits ?? 0),'Service credits'],['Current plan',p?.name || 'No plan selected','Plan status'],['Service tickets',String(tickets.length),'All requests'],['Payments',String(payments.length),'Recorded payments']])}<div class="portal-cols">${panel('Select or change plan',planPanel)}${panel('Current plan',p ? `<p><b>${html(p.name)}</b></p><p>${html(p.description || '')}</p><p>${fmtMoney(p.price)} · ${p.credits} service credits</p>` : empty('Choose a plan to get started.'))}</div>${panel('Appointments',`<div class="portal-list">${appointmentHtml}</div>`)}${panel('Payments',`<div class="portal-list">${paymentHtml}</div>`)}<div class="portal-cols">${panel('Request a service',serviceForm)}${panel('Your service tickets',`<div class="portal-list">${ticketHtml}</div>`)}</div>${panel('Notifications',`<div class="portal-list">${notifHtml}</div>`)}`;
    $('#backendPlanForm')?.addEventListener('submit', async e=>{e.preventDefault();const planId=new FormData(e.currentTarget).get('planId');try{const result=await api('/api/customer/select-plan',{method:'POST',body:JSON.stringify({planId})});authState.selectedPlanId=planId;notify(result.message || 'Plan selected.');await refreshPortal();}catch(err){notify(err.message);}});
    $('#backendOfflineForm')?.addEventListener('submit', async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const planId = (data.plan && data.plan.id) || authState.selectedPlanId || $('#backendPlanForm select')?.value;if(!planId){notify('Please select a plan first.');return;}try{await api('/api/customer/select-plan',{method:'POST',body:JSON.stringify({planId})});const result=await api('/api/customer/offline-payment',{method:'POST',body:JSON.stringify({planId,method:f.get('method'),reference:f.get('reference')})});notify(result.message || 'Payment request recorded.');await refreshPortal();}catch(err){notify(err.message);}});
    $('#backendTicketForm')?.addEventListener('submit', async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const result=await api('/api/customer/tickets',{method:'POST',body:JSON.stringify({service:f.get('service'),description:f.get('description')})});notify(`${result.message} Ticket: ${result.ticketCode}`);await refreshPortal();}catch(err){notify(err.message);}});
  }
  function renderTicketRows(tickets, admin = false) {
    if (!tickets?.length) return empty('No service tickets found.');
    return tickets.map(t=>`<div class="portal-row" style="display:block"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><b>${html(t.ticket_code)} · ${html(t.service)}</b><small>${html(t.customer_name || 'Customer')} · ${html(t.customer_phone || '')} · ${fmtDate(t.created_at)}</small><p>${html(t.description || 'No details provided')}</p>${t.employee_name ? `<small>Assigned to: ${html(t.employee_name)}</small>` : ''}${t.photo_path ? `<p><a href="${html(t.photo_path)}" target="_blank" rel="noopener">View work photo</a></p>` : ''}</div>${statusBadge(t.status)}</div><form class="backendTicketUpdate" data-ticket-id="${Number(t.id)}"><label class="portal-field"><span>Status</span><select name="status"><option value="open" ${t.status==='open'?'selected':''}>Open</option><option value="assigned" ${t.status==='assigned'?'selected':''}>Assigned</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>In progress</option><option value="completed" ${t.status==='completed'?'selected':''}>Completed</option><option value="cancelled" ${t.status==='cancelled'?'selected':''}>Cancelled</option></select></label><label class="portal-field"><span>Work note</span><input name="note" placeholder="Update / visit note" value="${html(t.employee_note || '')}"></label><label class="portal-field"><span>Work photo (JPG, PNG, WEBP; max size per server settings)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="portal-action" type="submit">Save ticket update</button></form></div>`).join('');
  }
  function renderEmployee(data, partnerData = null) {
    const tickets = data.tickets || [];
    const partnerPanel = partnerData ? panel('Partner overview', `<p>Referral code: <b>${html(partnerData.partner?.referral_code || 'Pending')}</b></p><div class="portal-grid">${[['Referrals',partnerData.stats?.referrals || 0],['Eligible',partnerData.stats?.eligible || 0],['Commission',fmtMoney(partnerData.stats?.commission || 0)]].map(([l,v])=>`<div class="portal-stat"><span>${html(l)}</span><strong>${html(v)}</strong></div>`).join('')}</div><div class="portal-list">${(partnerData.referrals || []).map(r=>row(`${r.customer_name || 'Customer'} · ${fmtMoney(r.commission)}`,fmtDate(r.created_at),statusBadge(r.status))).join('') || empty('No referrals yet.')}</div>`) : '';
    $('#portalContent').innerHTML = `<div class="portal-welcome"><div><span class="portal-tag">${partnerData ? 'Partner portal' : 'Service team portal'}</span><h1>Hello, ${html(authState.user?.name || 'Team member')}</h1><p>Review assigned service work and submit status updates.</p></div>${statusBadge(authState.user?.role || 'employee')}</div>${stats([['Visible tickets',tickets.length,'Assigned or available'],['Open',tickets.filter(t=>!['completed','cancelled'].includes(t.status)).length,'Need attention'],['Completed',tickets.filter(t=>t.status==='completed').length,'Finished work']])}${partnerPanel}${panel('Service tickets',renderTicketRows(tickets))}`;
    wireTicketUpdateForms();
  }
  function renderAdmin(data) {
    const s = data.stats || {};
    const customers = data.customers || [];
    const payments = data.payments || [];
    const apps = data.partnerApplications || [];
    const employees = data.employees || [];
    const customersHtml = customers.length ? customers.map(c=>row(c.name,`${c.email || ''} ${c.phone || ''} · ${c.credits} credits · ${fmtDate(c.created_at)}`,`${statusBadge(c.active ? 'active':'inactive')} <button class="portal-action" onclick="backendToggleCustomer(${Number(c.id)},${c.active ? 'false':'true'})">${c.active?'Disable':'Enable'}</button>`)).join('') : empty('No customers yet.');
    const paymentHtml = payments.length ? payments.map(p=>row(`${p.customer_name} · ${p.plan_name || 'Plan'} · ${fmtMoney(p.amount)}`,`${p.method} · ${fmtDate(p.created_at)} · ${p.customer_phone || ''}`,`${statusBadge(p.status)} ${['pending','customer_confirmed'].includes(p.status) ? `<button class="portal-action primary" onclick="backendVerifyPayment(${Number(p.id)})">Verify payment</button>`:''}`)).join('') : empty('No payments yet.');
    const partnerHtml = apps.length ? apps.map(p=>row(`${p.name} · ${p.partner_type || 'Partner'}`,`${p.email} · ${p.phone} · ${p.city || ''} · Status: ${p.partner_status}`,p.partner_status==='pending'?`<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="portal-action primary" onclick="backendSetPartner(${Number(p.id)},'approved')">Approve</button><button class="portal-action" onclick="backendSetPartner(${Number(p.id)},'rejected')">Reject</button></div>`:statusBadge(p.partner_status))).join('') : empty('No partner applications yet.');
    const enquiryHtml = (data.enquiries || []).length ? data.enquiries.map(q=>row(`${q.name} · ${q.phone}`,`${q.requirement} · ${fmtDate(q.created_at)}`,statusBadge(q.status))).join('') : empty('No consultation enquiries yet.');
    const employeeForm = `<form id="backendEmployeeForm"><label class="portal-field"><span>Full name</span><input name="name" required></label><label class="portal-field"><span>Email (optional if phone supplied)</span><input name="email" type="email"></label><label class="portal-field"><span>Phone (optional if email supplied)</span><input name="phone" type="tel"></label><label class="portal-field"><span>Temporary password (minimum 8 characters)</span><input name="password" type="password" minlength="8" required></label><label class="portal-field"><span>Role</span><select name="role"><option value="employee">Employee</option><option value="partner">Partner</option></select></label><button class="portal-action primary" type="submit">Create staff account</button></form>`;
    $('#portalContent').innerHTML = `<div class="portal-welcome"><div><span class="portal-tag">Administration</span><h1>Admin dashboard</h1><p>Live figures from the SGS SOLUTION database.</p></div>${statusBadge('secure backend')}</div>${stats([['Customers',s.customers || 0,'Registered customers'],['Employees / partners',s.employees || 0,'Team accounts'],['Open tickets',s.openTickets || 0,'Need attention'],['Pending payments',s.pendingPayments || 0,'Awaiting verification'],['Revenue',fmtMoney(s.revenue || 0),'Verified payments']])}<div class="portal-cols">${panel('Customers',`<div class="portal-list">${customersHtml}</div>`)}${panel('Create employee / partner',employeeForm)}</div>${panel('Payment verification',`<div class="portal-list">${paymentHtml}</div>`)}${panel('Partner applications',`<div class="portal-list">${partnerHtml}</div>`)}${panel('Solar consultation enquiries',`<div class="portal-list">${enquiryHtml}</div>`)}${panel('All service tickets',renderTicketRows(data.tickets || [],true))}`;
    wireTicketUpdateForms();
    $('#backendEmployeeForm')?.addEventListener('submit', async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api('/api/admin/employees',{method:'POST',body:JSON.stringify(Object.fromEntries(f.entries()))});notify('Staff account created. Share the credentials securely.');await refreshPortal();}catch(err){notify(err.message);}});
  }
  function wireTicketUpdateForms() {
    $$('.backendTicketUpdate').forEach(form=>form.addEventListener('submit', async e=>{
      e.preventDefault();const fd=new FormData(form);try{await api(`/api/employee/tickets/${form.dataset.ticketId}/update`,{method:'POST',body:fd});notify('Ticket update saved.');await refreshPortal();}catch(err){notify(err.message);}
    }));
  }
  async function loadDashboardForRole() {
    if (!authState.user) throw new Error('Please log in again.');
    if (authState.user.role === 'customer') return api('/api/customer/dashboard');
    if (authState.user.role === 'admin') return api('/api/admin/overview');
    if (authState.user.role === 'partner') {
      const [employee, partner] = await Promise.all([api('/api/employee/dashboard'), api('/api/partner/dashboard')]);
      return {employee, partner};
    }
    return api('/api/employee/dashboard');
  }
  async function refreshPortal() {
    try {
      if (!authState.plans.length) authState.plans = await api('/api/plans');
      const data = await loadDashboardForRole(); authState.dashboard = data;
      if (authState.user.role === 'customer') renderCustomer(data);
      else if (authState.user.role === 'admin') renderAdmin(data);
      else if (authState.user.role === 'partner') renderEmployee(data.employee, data.partner);
      else renderEmployee(data);
    } catch (error) {
      if (!authState.token) { window.closePortal(); window.openModal('login'); }
      else $('#portalContent').innerHTML = `<div class="portal-panel"><h3>Could not load dashboard</h3><p>${html(error.message)}</p><button class="portal-action primary" onclick="backendRefreshPortal()">Try again</button></div>`;
    }
  }
  window.backendRefreshPortal = refreshPortal;
  window.openPortal = async function(role) {
    if (!authState.user) { window.openModal(role === 'admin' ? 'admin' : role === 'employee' || role === 'partner' ? 'partner' : 'login'); return; }
    $('#portalOverlay').classList.add('open');
    $('#portalRole').textContent = String(authState.user.role || role || 'customer').toUpperCase();
    const actions = $('.portal-top-actions');
    if (actions && !$('#backendLogoutBtn')) actions.insertAdjacentHTML('beforeend','<button id="backendLogoutBtn" class="btn btn-outline" style="color:#f8fbe9;border-color:#64708e" onclick="backendLogout()">Log out</button>');
    await refreshPortal();
  };
  window.backendLogout = function() {
    authState.token = ''; authState.user = null; authState.dashboard = null;
    localStorage.removeItem('sgs_token'); $('#portalOverlay').classList.remove('open');
    const btn = $('#backendLogoutBtn'); if (btn) btn.remove();
    notify('You have been logged out.');
  };
  window.backendConfirmPayment = async function(id) {
    try { const r = await api(`/api/customer/payments/${id}/confirm`,{method:'POST',body:'{}'}); notify(r.message || 'Payment confirmation sent.'); await refreshPortal(); }
    catch(e) { notify(e.message); }
  };
  window.backendVerifyPayment = async function(id) {
    if (!confirm('Verify this payment only if SGS SOLUTION has actually received the funds. Continue?')) return;
    try { await api(`/api/admin/payments/${id}/verify`,{method:'POST',body:'{}'}); notify('Payment verified and plan credits activated.'); await refreshPortal(); }
    catch(e) { notify(e.message); }
  };
  window.backendSetPartner = async function(id, status) {
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this partner application?`)) return;
    try { await api(`/api/admin/partners/${id}/status`,{method:'PATCH',body:JSON.stringify({status})}); notify('Partner application updated.'); await refreshPortal(); }
    catch(e) { notify(e.message); }
  };
  window.backendToggleCustomer = async function(id, active) {
    if (!confirm(`${active ? 'Enable' : 'Disable'} this account?`)) return;
    try { await api(`/api/admin/users/${id}/status`,{method:'PATCH',body:JSON.stringify({active})}); notify('Customer account updated.'); await refreshPortal(); }
    catch(e) { notify(e.message); }
  };
  window.backendStartOnlinePayment = async function() {
    try {
      if (authState.user?.role !== 'customer') throw new Error('Please log in with a customer account.');
      const selectedId = $('#backendPlanForm select')?.value || authState.selectedPlanId || authState.dashboard?.plan?.id;
      if (!selectedId) throw new Error('Please select a plan first.');
      const order = await api('/api/customer/checkout',{method:'POST',body:JSON.stringify({planId:selectedId})});
      if (!window.Razorpay) {
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;script.onerror=()=>reject(new Error('Razorpay checkout could not load.'));document.head.appendChild(script);});
      }
      const rzp = new window.Razorpay({key:order.keyId,amount:order.amount,currency:order.currency,name:'SGS SOLUTION',description:'Solar care plan',order_id:order.orderId,prefill:order.customer,theme:{color:'#183b25'},handler:async response=>{try{const verified=await api('/api/payments/razorpay/verify',{method:'POST',body:JSON.stringify({...response,paymentId:order.paymentId})});notify(verified.message || 'Payment verified.');await refreshPortal();}catch(err){notify(err.message);}}});
      rzp.on('payment.failed', r=>notify(r.error?.description || 'Payment failed. Please retry or use offline payment.'));
      rzp.open();
    } catch (error) {
      notify(error.message);
      if (error.message.includes('not configured')) notify('Online payment is not configured. Use the offline payment request form; payment remains pending until staff verification.');
    }
  };

  async function bootBackendIntegration() {
    // Remove the demo-only warning and provide a real partner-application path.
    const notice = $('#modalNotice');
    if (notice) notice.textContent = 'Connected to SGS SOLUTION backend. Accounts and requests are saved on the server.';
    const dropdown = $('#dropdown');
    if (dropdown && !$('#partnerApplyMenu')) dropdown.insertAdjacentHTML('beforeend','<button id="partnerApplyMenu" onclick="openModal(\'partnerApply\')">＋ Apply as a service partner</button>');
    try { authState.plans = await api('/api/plans'); } catch (_) { /* health errors are shown when the user opens a feature */ }
    if (authState.token) {
      try {
        const me = await api('/api/auth/me'); authState.user = me.user;
        await window.openPortal(authState.user.role);
      } catch (_) {
        authState.token = ''; authState.user = null; localStorage.removeItem('sgs_token');
      }
    }
  }
  document.addEventListener('DOMContentLoaded', bootBackendIntegration);
})();
