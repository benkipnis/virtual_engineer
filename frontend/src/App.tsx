import { useState } from "react";
import { ChatProvider } from "./context/ChatContext";
import { OverviewTab } from "./tabs/OverviewTab";
import { EvidenceBoardTab } from "./tabs/EvidenceBoardTab";
import { FieldChatTab } from "./tabs/FieldChatTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence Board" },
  { id: "field", label: "Field Chat" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AppShell() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Virtual Engineer</h1>
          <div className="subtitle">Powered by MongoDB Atlas</div>
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {tab === "overview" && <OverviewTab onNavigate={(id) => setTab(id as TabId)} />}
        {tab === "evidence" && <EvidenceBoardTab />}
        {tab === "field" && <FieldChatTab />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <AppShell />
    </ChatProvider>
  );
}
