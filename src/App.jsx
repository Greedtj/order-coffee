import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  Coffee,
  Copy,
  DownloadSimple,
  ImageSquare,
  Plus,
  SignOut,
  Storefront,
  Trash,
  X,
} from "@phosphor-icons/react";
import { api, downloadCsv } from "./api.js";

const shops = ["Café Amazon", "พันธุ์ไทย คอฟฟี่"];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function clientToken() {
  const key = "coffee-order-client";
  const current = localStorage.getItem(key);
  if (current) return current;
  const token = crypto.randomUUID();
  localStorage.setItem(key, token);
  return token;
}

function Field({ label, required, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {required && <b aria-hidden="true">*</b>}
      </span>
      {children}
    </label>
  );
}

function MenuModal({ images, onClose }) {
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="menu-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="menu-title">รูปเมนู</h2>
          <button className="icon-button" onClick={onClose} aria-label="ปิดรูปเมนู">
            <X size={26} weight="bold" />
          </button>
        </header>
        <div className="menu-gallery">
          {images.map((image, index) => (
            <img key={image.id} src={image.url} alt={`เมนูหน้าที่ ${index + 1}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectFacts({ project }) {
  return (
    <dl className="project-facts">
      <div>
        <dt><CalendarBlank size={24} /></dt>
        <dd><small>โปรเจกต์</small><strong>{project.name}</strong></dd>
      </div>
      <div>
        <dt><CalendarBlank size={24} /></dt>
        <dd><small>วันที่</small><strong>{formatDate(project.order_date)}</strong></dd>
      </div>
      <div>
        <dt><Storefront size={24} /></dt>
        <dd><small>ร้าน</small><strong>{project.shop}</strong></dd>
      </div>
    </dl>
  );
}

function UserView() {
  const [state, setState] = useState({ loading: true, project: null, order: null });
  const [name, setName] = useState(localStorage.getItem("coffee-order-name") || "");
  const [details, setDetails] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api(`/api/project?clientToken=${encodeURIComponent(clientToken())}`)
      .then((data) => {
        setState({ loading: false, project: data.project, order: data.order });
        if (data.order) {
          setName(data.order.customer_name);
          setDetails(data.order.details);
        }
      })
      .catch((error) => setState({ loading: false, error: error.message }));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: { clientToken: clientToken(), name, details },
      });
      localStorage.setItem("coffee-order-name", name.trim());
      setState((current) => ({ ...current, order }));
      setNotice("บันทึกออเดอร์แล้ว");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) return <main className="center-state"><Coffee size={42} className="pulse" /><p>กำลังเปิดโต๊ะรับออเดอร์…</p></main>;
  if (!state.project) return (
    <main className="center-state">
      <Coffee size={50} />
      <h1>ยังไม่เปิดรับออเดอร์</h1>
      <p>กลับมาใหม่เมื่อผู้ดูแลเปิดโครงการนะ</p>
      <a className="text-link" href="#admin">สำหรับผู้ดูแล</a>
    </main>
  );

  return (
    <main className="order-page">
      <header className="app-header">
        <button className="icon-button" onClick={() => history.back()} aria-label="ย้อนกลับ">
          <ArrowLeft size={30} />
        </button>
        <h1>สั่งเครื่องดื่ม</h1>
        <span aria-hidden="true" />
      </header>

      <ProjectFacts project={state.project} />

      <form className="order-form" onSubmit={submit}>
        <Field label="ชื่อของคุณ" required>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="กรอกชื่อของคุณ" required />
        </Field>
        <Field label="ออเดอร์ที่ต้องการ" required>
          <div className="textarea-wrap">
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={300} placeholder="เช่น เอสเพรสโซ่เย็น หวานน้อย เพิ่มช็อต 1" required />
            <span>{details.length}/300</span>
          </div>
        </Field>

        <button className="secondary-button" type="button" disabled={!state.project.images.length} onClick={() => setShowMenu(true)}>
          <ImageSquare size={27} />
          {state.project.images.length ? "ดูรูปเมนู" : "ยังไม่มีรูปเมนู"}
        </button>
        <button className="primary-button" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกออเดอร์"}</button>
        {notice && <p className={notice.includes("แล้ว") ? "notice success" : "notice"} role="status">{notice.includes("แล้ว") && <CheckCircle size={20} weight="fill" />}{notice}</p>}
        <p className="form-note">แก้ไขได้จนกว่าจะปิดรับออเดอร์</p>
      </form>
      {showMenu && <MenuModal images={state.project.images} onClose={() => setShowMenu(false)} />}
    </main>
  );
}

function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      onLogin();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login">
      <a className="back-link" href="#"><ArrowLeft size={20} /> กลับหน้าสั่ง</a>
      <form onSubmit={submit}>
        <Coffee size={42} weight="fill" />
        <h1>หลังบ้าน</h1>
        <p>กรอกรหัสผ่านผู้ดูแล</p>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required />
        <button className="primary-button" disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
        {error && <p className="notice" role="alert">{error}</p>}
      </form>
    </main>
  );
}

function NewProject({ onCreated }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shop, setShop] = useState(shops[0]);

  async function submit(event) {
    event.preventDefault();
    await api("/api/admin/projects", { method: "POST", body: { name, date, shop } });
    setName("");
    onCreated();
  }

  return (
    <form className="admin-panel project-form" onSubmit={submit}>
      <h2><Plus size={22} /> สร้างโครงการ</h2>
      <div className="form-grid">
        <Field label="ชื่อโครงการ" required><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></Field>
        <Field label="วันที่" required><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
        <Field label="ร้าน" required><select value={shop} onChange={(event) => setShop(event.target.value)}>{shops.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>
      <button className="primary-button compact">สร้างโครงการ</button>
    </form>
  );
}

function ProjectManager({ projects, onChange }) {
  async function setStatus(project, status) {
    await api(`/api/admin/projects/${project.id}`, { method: "PATCH", body: { status } });
    onChange();
  }

  async function addMenu(project) {
    const imageUrl = prompt("วางลิงก์รูปเมนูที่เปิดดูได้แบบสาธารณะ");
    if (!imageUrl) return;
    await api(`/api/admin/projects/${project.id}/menu`, { method: "POST", body: { imageUrl } });
    onChange();
  }

  return (
    <section className="admin-panel">
      <h2>โครงการทั้งหมด</h2>
      <div className="project-list">
        {projects.map((project) => (
          <article className="project-row" key={project.id}>
            <div>
              <span className={`status ${project.status}`}>{project.status === "open" ? "เปิดรับอยู่" : project.status === "closed" ? "ปิดแล้ว" : "แบบร่าง"}</span>
              <h3>{project.name}</h3>
              <p>{project.shop} · {formatDate(project.order_date)} · {project.order_count} ออเดอร์</p>
            </div>
            <div className="project-actions">
              <button className="upload-button" onClick={() => addMenu(project)}>
                <ImageSquare size={19} /> รูปเมนู ({project.image_count})
              </button>
              {project.status === "open" ? (
                <button className="danger-button" onClick={() => setStatus(project, "closed")}>ปิดรับ</button>
              ) : (
                <button className="secondary-button small" onClick={() => setStatus(project, "open")}>เปิดรับ</button>
              )}
            </div>
          </article>
        ))}
        {!projects.length && <p className="empty-copy">ยังไม่มีโครงการ</p>}
      </div>
    </section>
  );
}

function Orders({ orders, onDelete }) {
  const summary = useMemo(() => orders.map((order, index) => `${index + 1}. ${order.customer_name}: ${order.details}`).join("\n"), [orders]);

  async function copy() {
    await navigator.clipboard.writeText(summary);
  }

  return (
    <section className="admin-panel orders-panel">
      <div className="panel-heading">
        <div><h2>ออเดอร์ล่าสุด</h2><p>{orders.length} รายการ</p></div>
        <div>
          <button className="utility-button" onClick={copy} disabled={!orders.length}><Copy size={18} /> คัดลอก</button>
          <button className="utility-button" onClick={() => downloadCsv(orders)} disabled={!orders.length}><DownloadSimple size={18} /> CSV</button>
        </div>
      </div>
      <div className="order-list">
        {orders.map((order, index) => (
          <article className="order-row" key={order.id}>
            <span className="order-number">{index + 1}</span>
            <div><h3>{order.customer_name}</h3><p>{order.details}</p></div>
            <button className="icon-button delete" onClick={() => onDelete(order.id)} aria-label={`ลบออเดอร์ของ ${order.customer_name}`}><Trash size={20} /></button>
          </article>
        ))}
        {!orders.length && <p className="empty-copy">ยังไม่มีออเดอร์ในโครงการที่เปิดอยู่</p>}
      </div>
    </section>
  );
}

function AdminDashboard({ onLogout }) {
  const [state, setState] = useState({ projects: [], orders: [] });
  const [error, setError] = useState("");

  async function load() {
    try {
      setState(await api("/api/admin/state"));
      setError("");
    } catch (caught) {
      if (caught.status === 401) onLogout();
      else setError(caught.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function logout() {
    await api("/api/admin/logout", { method: "POST" });
    onLogout();
  }

  async function deleteOrder(id) {
    if (!confirm("ลบออเดอร์นี้ใช่ไหม?")) return;
    await api(`/api/admin/orders/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><Coffee size={28} weight="fill" /><div><h1>หลังบ้าน</h1><p>จัดการรอบสั่งเครื่องดื่ม</p></div></div>
        <button className="utility-button" onClick={logout}><SignOut size={19} /> ออกจากระบบ</button>
      </header>
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="admin-content">
        <NewProject onCreated={load} />
        <ProjectManager projects={state.projects} onChange={load} />
        <Orders orders={state.orders} onDelete={deleteOrder} />
      </div>
    </main>
  );
}

function AdminView() {
  const [authenticated, setAuthenticated] = useState(null);
  useEffect(() => {
    api("/api/admin/state").then(() => setAuthenticated(true)).catch(() => setAuthenticated(false));
  }, []);
  if (authenticated === null) return <main className="center-state"><Coffee size={42} className="pulse" /></main>;
  return authenticated ? <AdminDashboard onLogout={() => setAuthenticated(false)} /> : <Login onLogin={() => setAuthenticated(true)} />;
}

export function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const change = () => setRoute(location.hash);
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return route === "#admin" ? <AdminView /> : <UserView />;
}
