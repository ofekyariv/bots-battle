// ============================================================
// 🏴‍☠️ /editor — Full-screen bot code editor
// ============================================================
// Layout:
//   ┌──────────────────────────────────────────────────────────┐
//   │  Toolbar: [My Bots ▾] | Name | W/L | Save | ▶ Test | ⚔️│
//   ├──────────────────────────────────────┬───────────────────┤
//   │  Monaco Editor (60%)                 │  Sidebar (40%)    │
//   │                                      │  Tabs:            │
//   │                                      │  [API Docs][Hist] │
//   ├──────────────────────────────────────┴───────────────────┤
//   │  Console output (collapsible)                           │
//   └──────────────────────────────────────────────────────────┘
// ============================================================

'use client';

import dynamic from 'next/dynamic';
import { useEditorState } from '@/hooks/useEditorState';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { ConsoleOutput } from '@/components/editor/ConsoleOutput';

// ── Monaco — dynamically imported (no SSR) ────────────────────
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center h-full text-sm"
      style={{ color: '#94a3b8', background: '#1e1e1e' }}
    >
      ⚓ Loading editor…
    </div>
  ),
});

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function EditorPage() {
  const {
    editorRef,
    code,
    botName,
    setBotName,
    currentBotId,
    isDirty,
    editorLanguage,
    savedBots,
    showBotDropdown,
    setShowBotDropdown,
    showDeleteConfirm,
    setShowDeleteConfirm,
    versions,
    sidebarTab,
    setSidebarTab,
    saveStatus,
    logs,
    setLogs,
    consoleCollapsed,
    setConsoleCollapsed,
    llmCopyStatus,
    record,
    isAuthenticated,
    loadBotData,
    handleBeforeMount,
    handleMount,
    handleCodeChange,
    handleSave,
    handleNew,
    handleDelete,
    handleLanguageChange,
    handleRunTest,
    handleRestore,
    handleCopyForLLM,
    handleLoadExample,
  } = useEditorState();

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 57px)', background: 'var(--navy)', overflow: 'hidden' }}
    >
      {/* ══ TOOLBAR ══════════════════════════════════════════════ */}
      <EditorToolbar
        savedBots={savedBots}
        currentBotId={currentBotId}
        isDirty={isDirty}
        botName={botName}
        setBotName={setBotName}
        record={record}
        saveStatus={saveStatus}
        llmCopyStatus={llmCopyStatus}
        showBotDropdown={showBotDropdown}
        setShowBotDropdown={setShowBotDropdown}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        editorLanguage={editorLanguage}
        onLanguageChange={handleLanguageChange}
        onNew={handleNew}
        onLoad={loadBotData}
        onDelete={handleDelete}
        onSave={() => handleSave()}
        onRunTest={handleRunTest}
        onCopyForLLM={handleCopyForLLM}
        isAuthenticated={isAuthenticated}
      />

      {/* ══ MAIN AREA ════════════════════════════════════════════ */}
      {/* Mobile: stacked vertically. md+: side-by-side 60/40.     */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Monaco Editor column: 50vh tall on mobile, full height on desktop */}
        <div
          className="flex flex-col overflow-hidden shrink-0
            h-[50vh] w-full border-b border-[#1e3a5f]
            md:h-auto md:w-[55%] md:border-b-0 md:border-r md:border-[#1e3a5f]"
        >
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              defaultLanguage={editorLanguage}
              language={editorLanguage}
              value={code}
              theme="vs-dark"
              beforeMount={handleBeforeMount}
              onMount={handleMount}
              onChange={handleCodeChange}
              options={{
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
                renderValidationDecorations: 'on',
                suggestOnTriggerCharacters: true,
                quickSuggestions: { other: true, comments: false, strings: false },
                parameterHints: { enabled: true },
                folding: true,
                formatOnPaste: true,
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                matchBrackets: 'always',
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        </div>

        {/* Right Sidebar — full width on mobile, 40% on desktop */}
        <div className="flex-1 min-h-0 overflow-hidden md:w-[45%]">
          <EditorSidebar
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            versions={versions}
            currentCode={editorRef.current?.getValue() ?? code}
            onRestore={handleRestore}
            editorLanguage={editorLanguage}
            onLoadExample={handleLoadExample}
          />
        </div>
      </div>

      {/* ══ CONSOLE ════════════════════════════════════════════════ */}
      <ConsoleOutput
        logs={logs}
        onClear={() => setLogs([])}
        collapsed={consoleCollapsed}
        onToggle={() => setConsoleCollapsed((v) => !v)}
      />
    </div>
  );
}
