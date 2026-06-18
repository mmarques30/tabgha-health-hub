import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Users,
  TrendingUp,
  Zap,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  Star,
  Brain,
  Target,
  Rocket,
  Instagram,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tabgha Health Marketing — Mais pacientes. Todo mês." },
      {
        name: "description",
        content:
          "A Tabgha transforma a presença digital de clínicas e consultórios em resultado previsível — com estratégia, conteúdo médico e tecnologia integrados.",
      },
      { property: "og:title", content: "Tabgha Health Marketing" },
      {
        property: "og:description",
        content:
          "Marketing médico com estratégia, conteúdo e tecnologia. Resultado previsível para clínicas e consultórios.",
      },
    ],
  }),
  component: Landing,
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    label: "Diagnóstico & Estratégia",
    desc: "Mapeamos o posicionamento da sua clínica, o perfil do paciente ideal e definimos a estratégia de crescimento com base em dados — não em achismo.",
    items: ["Análise de concorrência local", "Persona detalhada por especialidade", "Funil de captação desenhado"],
  },
  {
    icon: Instagram,
    label: "Conteúdo Médico",
    desc: "Criamos e publicamos conteúdo técnico e humanizado que educa pacientes, gera autoridade e mantém sua agenda cheia.",
    items: ["Roteiros e artes para redes sociais", "Pipeline editorial 30 dias à frente", "Aprovação em um clique"],
  },
  {
    icon: Zap,
    label: "Tecnologia & Automação",
    desc: "Nossa plataforma centraliza leads, métricas e comunicação — e automatiza o que rouba seu tempo sem gerar resultado.",
    items: ["CRM de leads integrado", "Relatório de ROI em tempo real", "Automações de WhatsApp e Meta"],
  },
];

const STEPS = [
  {
    n: "01",
    title: "Diagnóstico gratuito",
    desc: "Analisamos sua presença digital atual, posicionamento, concorrência e oportunidades de crescimento. Sem custo, sem compromisso.",
  },
  {
    n: "02",
    title: "Estratégia personalizada",
    desc: "Montamos um plano de 90 dias específico para a sua especialidade, cidade e perfil de paciente — com metas e entregáveis claros.",
  },
  {
    n: "03",
    title: "Execução e resultado",
    desc: "Nossa equipe executa conteúdo, campanhas e automações enquanto você acompanha tudo em tempo real pelo portal.",
  },
];

const TESTIMONIALS = [
  {
    name: "Dra. Ana Claudia Mendes",
    role: "Dermatologista · São Paulo",
    stars: 5,
    text: "Em 4 meses a Tabgha triplicou meu volume de novos pacientes. A diferença é que eles chegam já sabendo quem sou — o conteúdo educa antes mesmo de marcar consulta.",
  },
  {
    name: "Dr. Rodrigo Figueiredo",
    role: "Ortopedista · Belo Horizonte",
    stars: 5,
    text: "Tentei outras agências antes. Nenhuma entendia o setor de saúde. A Tabgha não só entende como tem um portal próprio que me dá visibilidade total sobre leads e ROI.",
  },
  {
    name: "Clínica Sorrir Mais",
    role: "Odontologia · Curitiba",
    stars: 5,
    text: "Nossa agenda estava com 30% de ociosidade. Após o diagnóstico e as primeiras campanhas, fechamos 3 meses consecutivos com lista de espera.",
  },
];

const FAQS = [
  {
    q: "Para quais especialidades a Tabgha trabalha?",
    a: "Atendemos médicos e clínicas de qualquer especialidade — dermatologia, ortopedia, odontologia, psicologia, nutrição, cirurgia plástica, entre outras. Nossa metodologia se adapta ao perfil de paciente de cada área.",
  },
  {
    q: "Preciso ter CNPJ ou posso ser pessoa física?",
    a: "Atendemos tanto clínicas com CNPJ quanto profissionais autônomos com CRM/CRO ativos. Basta exercer legalmente a profissão.",
  },
  {
    q: "Quanto tempo para ver os primeiros resultados?",
    a: "Os primeiros leads costumam aparecer entre 30 e 45 dias após o início das campanhas. Resultados consistentes de agenda cheia normalmente se consolidam entre 60 e 90 dias.",
  },
  {
    q: "Como funciona o acesso ao portal?",
    a: "Cada cliente recebe um login próprio com visão do pipeline de leads, calendário editorial, métricas de ROI e canal direto com a equipe. Tudo em um lugar.",
  },
  {
    q: "A Tabgha cuida da criação de conteúdo ou só de tráfego pago?",
    a: "Fazemos os dois de forma integrada. Estratégia, produção de conteúdo orgânico, gestão de tráfego pago (Meta e Google) e automações de relacionamento — o pacote completo.",
  },
];

const SPECIALTIES = [
  "Dermatologia", "Ortopedia", "Odontologia", "Psicologia",
  "Cardiologia", "Nutrição", "Ginecologia", "Cirurgia Plástica",
];

const STATS = [
  { value: "+180", label: "Clínicas atendidas", icon: Users },
  { value: "+14k", label: "Leads gerados", icon: Target },
  { value: "4.1x", label: "ROAS médio", icon: TrendingUp },
  { value: "92%", label: "Retenção em 6 meses", icon: Rocket },
];

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#0B1628]/95 backdrop-blur-md shadow-lg shadow-black/20"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
          >
            T
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            Tabgha <span className="font-light" style={{ color: "rgba(255,255,255,0.5)" }}>Health</span>
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {[["#solucao", "Solução"], ["#resultados", "Resultados"], ["#depoimentos", "Depoimentos"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.65)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.65)" }}>
            Entrar
          </Link>
          <a
            href="#diagnostico"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all"
            style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4)",
              boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
            }}
          >
            Diagnóstico gratuito <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <button className="text-white md:hidden" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t px-6 py-4 md:hidden" style={{ background: "#0B1628", borderColor: "rgba(255,255,255,0.1)" }}>
          <nav className="flex flex-col gap-4">
            {[["#solucao", "Solução"], ["#resultados", "Resultados"], ["#depoimentos", "Depoimentos"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => setOpen(false)}>{label}</a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <Link to="/login" className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Entrar</Link>
              <a
                href="#diagnostico"
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
              >
                Diagnóstico gratuito <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ background: "#0B1628", position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* grid bg */}
      <div
        style={{
          position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* glow blobs */}
      <div style={{ position: "absolute", top: -160, left: "35%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "33%", right: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 text-center" style={{ paddingTop: 160, paddingBottom: 128 }}>
        {/* badge */}
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.1)", color: "#34d399" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ background: "#34d399" }} />
          Agência especializada em marketing médico
        </div>

        {/* headline */}
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl" style={{ lineHeight: 1.08 }}>
          Mais pacientes para{" "}
          <span style={{ backgroundImage: "linear-gradient(135deg, #34d399, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            sua clínica.
          </span>
          <br />
          Todo mês.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: "rgba(255,255,255,0.6)" }}>
          A Tabgha conecta estratégia, conteúdo médico e tecnologia para transformar
          sua presença digital em agenda cheia — com previsibilidade e sem achismo.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="#diagnostico"
            className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4)",
              boxShadow: "0 8px 32px rgba(16,185,129,0.35)",
            }}
          >
            Solicitar diagnóstico gratuito
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#solucao"
            className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}
          >
            Ver como funciona
          </a>
        </div>

        {/* Stats bar */}
        <div
          className="mt-20 grid w-full max-w-3xl grid-cols-2 md:grid-cols-4 overflow-hidden rounded-2xl"
          style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}
        >
          {STATS.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center px-6 py-6" style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
              <span className="text-3xl font-extrabold text-white md:text-4xl">{s.value}</span>
              <span className="mt-1 text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* wave divider */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
  return (
    <section style={{ background: "#f8fafc", paddingTop: 56, paddingBottom: 56 }}>
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: "#94a3b8" }}>
          Especialidades que confiam na Tabgha
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {SPECIALTIES.map((s) => (
            <span
              key={s}
              className="rounded-full px-4 py-1.5 text-sm font-medium"
              style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#475569", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────

function ProblemSection() {
  const pains = [
    { icon: "📉", title: "Agenda com buracos todo mês", desc: "Sem estratégia, cada mês começa do zero. Você depende de indicação e torce para o telefone tocar." },
    { icon: "🌀", title: "Agência que não entende saúde", desc: "Posts genéricos, copy que viola o CFM, métricas de vaidade. Dinheiro gasto sem retorno mensurável." },
    { icon: "🔍", title: "Zero visibilidade sobre o que funciona", desc: "Não sabe quantos leads vieram de cada canal, qual campanha converteu, nem quanto custa um paciente novo." },
  ];

  return (
    <section style={{ background: "#0B1628", position: "relative", paddingTop: 96, paddingBottom: 96 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: "translateY(-1px)" }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block", transform: "rotate(180deg)" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#34d399" }}>O problema</span>
          <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
            Marketing médico sem estratégia <br className="hidden md:block" />
            <span style={{ color: "rgba(255,255,255,0.35)" }}>custa mais do que você imagina</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl p-8 transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }}
            >
              <span className="text-4xl">{p.icon}</span>
              <h3 className="mt-5 text-lg font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── Solution ─────────────────────────────────────────────────────────────────

function SolutionSection() {
  return (
    <section id="solucao" style={{ background: "#f8fafc", paddingTop: 112, paddingBottom: 112 }}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Nossa solução</span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">
            Tudo que uma clínica precisa <br className="hidden md:block" />
            para crescer com consistência
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "#64748b" }}>
            Não vendemos peças isoladas. Entregamos um sistema integrado de crescimento —
            estratégia, conteúdo e tecnologia funcionando juntos.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                className="group relative overflow-hidden rounded-3xl p-8 transition-all"
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.12))", color: "#059669" }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{f.label}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#64748b" }}>{f.desc}</p>
                <ul className="mt-6 space-y-2">
                  {f.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm" style={{ color: "#475569" }}>
                      <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "#10b981" }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section style={{ background: "#0B1628", position: "relative", paddingTop: 112, paddingBottom: 112 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: "translateY(-1px)" }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block", transform: "rotate(180deg)" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#34d399" }}>Como funciona</span>
          <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">Do diagnóstico à agenda cheia</h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* connecting line */}
          <div
            style={{
              position: "absolute", top: 32, left: "calc(16.666% + 1rem)", right: "calc(16.666% + 1rem)",
              height: 1, background: "linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.6), rgba(16,185,129,0.15))",
              display: "none",
            }}
            className="md:block"
          />

          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col items-center text-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-extrabold"
                style={{ border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.1)", color: "#34d399" }}
              >
                {s.n}
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsSection() {
  return (
    <section id="resultados" style={{ background: "#f8fafc", paddingTop: 112, paddingBottom: 112 }}>
      <div className="mx-auto max-w-6xl px-6">
        <div
          className="overflow-hidden rounded-3xl p-12 shadow-2xl md:p-16"
          style={{
            background: "linear-gradient(135deg, #0B1628 0%, #0f2040 50%, #0a2535 100%)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          }}
        >
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#34d399" }}>Resultados reais</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
              Números que a sua clínica{" "}
              <span style={{ backgroundImage: "linear-gradient(135deg, #34d399, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                merece ter
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex flex-col items-center text-center">
                  <Icon className="mb-3 h-6 w-6" style={{ color: "rgba(52,211,153,0.6)" }} />
                  <span className="text-4xl font-extrabold text-white md:text-5xl">{s.value}</span>
                  <span className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function Testimonials() {
  return (
    <section id="depoimentos" style={{ background: "#f8fafc", paddingBottom: 112 }}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Depoimentos</span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">
            Quem já tem agenda cheia fala por nós
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-3xl p-8 transition-all"
              style={{ border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4" style={{ fill: "#f59e0b", color: "#f59e0b" }} />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed" style={{ color: "#475569" }}>"{t.text}"</p>
              <div className="mt-6 border-t pt-6" style={{ borderColor: "#f1f5f9" }}>
                <p className="text-sm font-bold text-slate-900">{t.name}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" style={{ background: "#0B1628", position: "relative", paddingTop: 112, paddingBottom: 112 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: "translateY(-1px)" }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block", transform: "rotate(180deg)" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>

      <div className="mx-auto max-w-2xl px-6">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#34d399" }}>FAQ</span>
          <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">Perguntas frequentes</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl transition-all"
              style={{ border: `1px solid ${open === i ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.1)"}`, background: "rgba(255,255,255,0.05)" }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="text-sm font-semibold text-white">{f.q}</span>
                <ChevronDown
                  className="ml-4 h-4 w-4 shrink-0 transition-transform"
                  style={{ color: "rgba(255,255,255,0.4)", transform: open === i ? "rotate(180deg)" : undefined }}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection() {
  const [email, setEmail] = useState("");

  return (
    <section id="diagnostico" style={{ background: "#f8fafc", paddingBottom: 112 }}>
      <div className="mx-auto max-w-6xl px-6">
        <div
          className="relative overflow-hidden rounded-3xl p-12 text-center shadow-2xl md:p-20"
          style={{
            background: "linear-gradient(135deg, #059669 0%, #0891b2 100%)",
            boxShadow: "0 24px 80px rgba(16,185,129,0.25)",
          }}
        >
          {/* blobs */}
          <div style={{ position: "absolute", top: -80, left: -80, width: 256, height: 256, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none", filter: "blur(40px)" }} />
          <div style={{ position: "absolute", bottom: -80, right: -80, width: 256, height: 256, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none", filter: "blur(40px)" }} />

          <div style={{ position: "relative" }}>
            <span
              className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              Gratuito e sem compromisso
            </span>
            <h2 className="mt-5 text-3xl font-extrabold text-white md:text-5xl">
              Pronto para ter uma<br />agenda cheia?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "rgba(255,255,255,0.8)" }}>
              Solicite o diagnóstico gratuito. Nossa equipe analisa sua presença digital
              e entrega um plano personalizado em até 48h.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-full px-5 py-3 text-sm text-white outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.2)" }}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-bold transition-all"
                style={{ background: "#fff", color: "#059669", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
              >
                Quero o diagnóstico <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              Sem spam. Seus dados são tratados com total confidencialidade.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: "#0B1628", paddingTop: 64, paddingBottom: 40 }}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
              >
                T
              </div>
              <span className="text-base font-bold text-white">
                Tabgha <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.4)" }}>Health Marketing</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              Estratégia, conteúdo e tecnologia integrados para clínicas e consultórios que querem crescer com previsibilidade.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Produto</h4>
            <ul className="space-y-3">
              {["Solução", "Como funciona", "Resultados", "FAQ"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>{l}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Empresa</h4>
            <ul className="space-y-3">
              {["Sobre nós", "Blog", "Política de privacidade", "Termos de uso"].map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>{l}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © {new Date().getFullYear()} Tabgha Health Marketing. Todos os direitos reservados.
          </p>
          <Link to="/login" className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
            Acesso à plataforma →
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function Landing() {
  return (
    <div className="font-sans antialiased">
      <Nav />
      <Hero />
      <TrustBar />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <ResultsSection />
      <Testimonials />
      <FAQ />
      <CTASection />
      <Footer />
    </div>
  );
}
