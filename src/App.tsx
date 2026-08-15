import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { GraphView } from "./GraphView";
import type { EvolutionRule, GraphView as GraphViewState, HeadShape, Mode, Selection, ShapeType } from "./types";
import { loadJson, normalizeEvolutionRules, normalizeHeadShape, normalizeHeadShapes, saveJson, serializeHeadShape } from "./data";
import { validateProjectData, type ValidationIssue } from "./validation";
import {
  ailmentTags,
  elementalTags,
  incomingRules,
  nextEvolutionRuleId,
  orderedParentShapeIds,
  outgoingRules,
  shapeById,
  sortRulesByGameNumber,
  specialTags,
  statusTags,
} from "./domain";
import { ailmentLabels, elementalLabels, shapeTypes, specialLabels, statusLabels } from "./labels";

type Dialog = "none" | "rules" | "features" | "json" | "validation" | "backup";
const SHOW_DEV_TOOLS = import.meta.env.VITE_PUBLIC_BUILD !== "true";

export function App() {
  const [headShapes, setHeadShapes] = useState<HeadShape[]>([]);
  const [evolutionRules, setEvolutionRules] = useState<EvolutionRule[]>([]);
  const [selected, setSelected] = useState<Selection>({ type: "shape", id: "" });
  const [graphRootId, setGraphRootId] = useState("");
  const [mode, setMode] = useState<Mode>("rules");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ShapeType | "all">("all");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [elementalFilters, setElementalFilters] = useState<Set<string>>(new Set());
  const [ailmentFilters, setAilmentFilters] = useState<Set<string>>(new Set());
  const [specialFilters, setSpecialFilters] = useState<Set<string>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [graphView, setGraphView] = useState<GraphViewState>({ scale: 1, panX: 0, panY: 0 });
  const [graphResetVersion, setGraphResetVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>("none");
  const [status, setStatus] = useState("");

  useEffect(() => {
    Promise.all([loadJson<unknown>("data/head-shapes.json"), loadJson<unknown>("data/evolution-rules.json")])
      .then(([shapeData, ruleData]) => {
        const shapes = normalizeHeadShapes(shapeData);
        const rules = normalizeEvolutionRules(ruleData);
        setHeadShapes(shapes);
        setEvolutionRules(rules);
        setSelected({ type: "shape", id: shapes[0]?.id ?? "" });
        setGraphRootId(shapes[0]?.id ?? "");
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  const selectedShape = shapeById(headShapes, selected.id);
  const filteredShapes = useMemo(
    () =>
      headShapes
        .filter((shape) => matchesTypeFilter(shape, typeFilter))
        .filter((shape) => matchesNumberFilters(shape, statusFilters, "statusBonus"))
        .filter((shape) => matchesNumberFilters(shape, elementalFilters, "elementalResistance"))
        .filter((shape) => matchesNumberFilters(shape, ailmentFilters, "ailmentResistance"))
        .filter((shape) => matchesNumberFilters(shape, specialFilters, "specialEffects"))
        .filter((shape) => !query || searchableValues(shape).join(" ").toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(a.gameNumber ?? 0) - Number(b.gameNumber ?? 0)),
    [headShapes, typeFilter, statusFilters, elementalFilters, ailmentFilters, specialFilters, query],
  );

  const selectShape = (id: string, resetGraph = false) => {
    setSelected({ type: "shape", id });
    if (resetGraph) {
      setGraphRootId(id);
      setExpandedSources(new Set());
      setExpandedResults(new Set());
      setCollapsedBranches(new Set());
      setGraphResetVersion((version) => version + 1);
    }
  };

  const toggleExpand = (direction: "sources" | "results", key: string) => {
    const setter = direction === "sources" ? setExpandedSources : setExpandedResults;
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const collapseBranch = (key: string) => {
    setCollapsedBranches((current) => new Set(current).add(key));
  };

  const saveHeadShapes = async (shapes: HeadShape[]) => {
    const payload = shapes.map(serializeHeadShape);
    await saveJson("/api/head-shapes", payload);
    setHeadShapes(normalizeHeadShapes(payload));
  };

  const saveRules = async (rules: EvolutionRule[]) => {
    const payload = normalizeEvolutionRules(rules);
    await saveJson("/api/evolution-rules", payload);
    setEvolutionRules(payload);
  };

  const restoreBackup = async (backup: unknown) => {
    if (!backup || typeof backup !== "object") throw new Error("バックアップJSONの形式が正しくありません。");
    const data = backup as { headShapes?: unknown; evolutionRules?: unknown };
    const shapes = normalizeHeadShapes(data.headShapes);
    const rules = normalizeEvolutionRules(data.evolutionRules);
    if (!shapes.length || !rules.length) throw new Error("headShapes または evolutionRules が空です。");
    await saveHeadShapes(shapes);
    await saveRules(rules);
    setSelected({ type: "shape", id: shapes[0]?.id ?? "" });
    setGraphRootId(shapes[0]?.id ?? "");
    setExpandedSources(new Set());
    setExpandedResults(new Set());
    setCollapsedBranches(new Set());
    setGraphResetVersion((version) => version + 1);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">new 電波人間のRPG FREE</p>
          <h1>頭の形 遺伝検索ツール</h1>
          <p className="header-description">
            頭の形ごとの特徴と標準出生ルートを検索し、進化元・進化先の組み合わせ候補を確認できます。
          </p>
        </div>
        {SHOW_DEV_TOOLS && (
          <div className="topbar-actions">
            <button className="icon-button" title="head-shapes.json を編集" type="button" onClick={() => setDialog("json")}>
              {"{}"}
            </button>
            <button className="icon-button" title="頭の形の特徴を編集" type="button" onClick={() => setDialog("features")}>
              ✎
            </button>
            <button className="icon-button" title="evolution-rules.json を編集" type="button" onClick={() => setDialog("rules")}>
              ⇄
            </button>
            <button className="icon-button" title="データを検証" type="button" onClick={() => setDialog("validation")}>
              ✓
            </button>
            <button className="icon-button" title="バックアップ/復元" type="button" onClick={() => setDialog("backup")}>
              ⇅
            </button>
          </div>
        )}
      </header>

      <main className="workspace">
        <aside className="panel search-panel">
          <div className="tabs" role="tablist" aria-label="検索対象">
            <button className={`tab ${mode === "rules" ? "active" : ""}`} type="button" onClick={() => setMode("rules")}>
              基本
            </button>
            <button className={`tab ${mode === "owned" ? "active" : ""}`} type="button" onClick={() => setMode("owned")}>
              所持
            </button>
            <button className={`tab ${mode === "records" ? "active" : ""}`} type="button" onClick={() => setMode("records")}>
              ルート
            </button>
          </div>
          <label className="field">
            <span>検索</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="まる、グー、AP、こうげきりょく" />
          </label>
          <FilterGroup
            title="タイプ"
            labels={shapeTypes}
            active={typeFilter === "all" ? new Set() : new Set([typeFilter])}
            single
            onClear={() => setTypeFilter("all")}
            onToggle={(key) => setTypeFilter(typeFilter === key ? "all" : (key as ShapeType))}
          />
          <FilterGroup title="ステータス補正" labels={statusLabels} active={statusFilters} onClear={() => setStatusFilters(new Set())} onToggle={(key) => toggleSetFilter(setStatusFilters, key)} />
          <FilterGroup title="属性耐性" labels={elementalLabels} active={elementalFilters} onClear={() => setElementalFilters(new Set())} onToggle={(key) => toggleSetFilter(setElementalFilters, key)} />
          <FilterGroup title="状態異常耐性" labels={ailmentLabels} active={ailmentFilters} onClear={() => setAilmentFilters(new Set())} onToggle={(key) => toggleSetFilter(setAilmentFilters, key)} />
          <FilterGroup title="特殊効果" labels={specialLabels} active={specialFilters} onClear={() => setSpecialFilters(new Set())} onToggle={(key) => toggleSetFilter(setSpecialFilters, key)} />
          <section className="quick-actions">
            <button className="secondary-button" type="button" disabled>
              所持キャラ追加（予定）
            </button>
            <button className="secondary-button" type="button" disabled>
              出生ルート追加（予定）
            </button>
          </section>
        </aside>

        <section className="panel results-panel">
          <div className="panel-heading">
            <h2>{mode === "rules" ? "基本ルール" : "開発予定"}</h2>
            <span className="count-pill">{mode === "rules" ? `${filteredShapes.length}件` : "予定"}</span>
          </div>
          <div className="results-list" aria-live="polite">
            {mode !== "rules" ? (
              <div className="result-card"><h3>ユーザDB機能は開発予定です</h3><p>標準出生ルールの確認後に実装します。</p></div>
            ) : filteredShapes.length === 0 ? (
              <div className="result-card"><h3>該当なし</h3><p>検索条件を変えてください。</p></div>
            ) : (
              filteredShapes.map((shape) => (
                <button
                  key={shape.id}
                  className={`result-card ${selected.id === shape.id ? "active" : ""}`}
                  type="button"
                  onClick={() => selectShape(shape.id, true)}
                >
                  <h3>{shape.name}</h3>
                  <p>{shape.notes}</p>
                  <div className="tag-row">
                    <span className="tag">No. {shape.gameNumber}</span>
                    <span className="tag">進化元 {incomingRules(evolutionRules, shape.id).length}</span>
                    <span className="tag">進化先 {outgoingRules(evolutionRules, shape.id).length}</span>
                    <span className="tag">{shapeTypes[shape.type]}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <GraphView
          rootShapeId={graphRootId}
          selectedShapeId={selected.id}
          shapes={headShapes}
          rules={evolutionRules}
          expandedSources={expandedSources}
          expandedResults={expandedResults}
          collapsedBranches={collapsedBranches}
          resetVersion={graphResetVersion}
          view={graphView}
          onViewChange={setGraphView}
          onToggleExpand={toggleExpand}
          onCollapseBranch={collapseBranch}
          onSelectShape={(id) => selectShape(id, false)}
          onResetExpansion={() => {
            setExpandedSources(new Set());
            setExpandedResults(new Set());
            setCollapsedBranches(new Set());
            setGraphResetVersion((version) => version + 1);
          }}
        />

        <aside className="panel detail-panel">
          <div className="panel-heading">
            <h2>詳細</h2>
            <span className="count-pill">頭の形</span>
          </div>
          <ShapeDetail shape={selectedShape} rules={evolutionRules} shapes={headShapes} onSelect={selectShape} />
        </aside>
      </main>

      {SHOW_DEV_TOOLS && dialog === "rules" && (
        <RuleEditor shapes={headShapes} rules={evolutionRules} onSave={saveRules} onClose={() => setDialog("none")} setStatus={setStatus} />
      )}
      {SHOW_DEV_TOOLS && dialog === "features" && (
        <FeatureEditor shapes={headShapes} onSave={saveHeadShapes} onClose={() => setDialog("none")} setStatus={setStatus} />
      )}
      {SHOW_DEV_TOOLS && dialog === "json" && (
        <JsonEditor shapes={headShapes} onSave={saveHeadShapes} onClose={() => setDialog("none")} setStatus={setStatus} />
      )}
      {SHOW_DEV_TOOLS && dialog === "validation" && <ValidationModal shapes={headShapes} rules={evolutionRules} onClose={() => setDialog("none")} />}
      {SHOW_DEV_TOOLS && dialog === "backup" && (
        <BackupModal
          shapes={headShapes}
          rules={evolutionRules}
          onRestore={restoreBackup}
          onClose={() => setDialog("none")}
          setStatus={setStatus}
        />
      )}
      {status && <div className="toast" onClick={() => setStatus("")}>{status}</div>}
    </div>
  );
}

function searchableValues(shape: HeadShape): string[] {
  return [
    shape.name,
    shapeTypes[shape.type],
    ...activeLabelValues(shape.statusBonus, statusLabels),
    ...activeLabelValues(shape.elementalResistance, elementalLabels),
    ...activeLabelValues(shape.ailmentResistance, ailmentLabels),
    ...activeLabelValues(shape.specialEffects, specialLabels),
  ];
}

function activeLabelValues(values: Record<string, number>, labels: Record<string, string>) {
  return Object.entries(labels).filter(([key]) => Number(values[key] ?? 0) !== 0).map(([, label]) => label);
}

function matchesTypeFilter(shape: HeadShape, filter: ShapeType | "all") {
  return filter === "all" || shape.type === filter;
}

function matchesNumberFilters(shape: HeadShape, filters: Set<string>, group: keyof Pick<HeadShape, "statusBonus" | "elementalResistance" | "ailmentResistance" | "specialEffects">) {
  return [...filters].every((key) => Number(shape[group][key] ?? 0) !== 0);
}

function toggleSetFilter(setter: Dispatch<SetStateAction<Set<string>>>, key: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

function FilterGroup({
  title,
  labels,
  active,
  onClear,
  onToggle,
}: {
  title: string;
  labels: Record<string, string>;
  active: Set<string>;
  single?: boolean;
  onClear: () => void;
  onToggle: (key: string) => void;
}) {
  return (
    <section className="filter-group">
      <div className="filter-title">{title}</div>
      <div className="filter-buttons">
        <button className={`filter-button ${active.size === 0 ? "active" : ""}`} type="button" onClick={onClear}>
          all
        </button>
        {Object.entries(labels).map(([key, label]) => (
          <button className={`filter-button ${active.has(key) ? "active" : ""}`} type="button" key={key} onClick={() => onToggle(key)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ShapeDetail({ shape, rules, shapes, onSelect }: { shape?: HeadShape; rules: EvolutionRule[]; shapes: HeadShape[]; onSelect: (id: string) => void }) {
  if (!shape) return <div className="detail-content"><p>未選択です。</p></div>;
  const sources = incomingRules(rules, shape.id);
  const results = outgoingRules(rules, shape.id);
  return (
    <div className="detail-content">
      <section className="detail-block detail-summary">
        {shape.image && <img className="shape-preview" src={shape.image} alt="" />}
        <div className="detail-summary-text">
          <strong>{shape.name}</strong>
          <span>No. {shape.gameNumber}</span>
          <span>タイプ: {shapeTypes[shape.type]}</span>
        </div>
      </section>
      <TagBlock title="ステータス補正" tags={statusTags(shape)} />
      <TagBlock title="属性耐性" tags={elementalTags(shape)} />
      <TagBlock title="状態異常耐性" tags={ailmentTags(shape)} />
      <TagBlock title="特殊効果" tags={specialTags(shape)} />
      <section className="detail-block">
        <span className="detail-label">備考</span>
        <div className="detail-note">{shape.notes || "なし"}</div>
      </section>
      <RuleBlock title="進化元の組み合わせ候補" rules={sources} shapes={shapes} onSelect={onSelect} />
      <RuleBlock title="進化先の組み合わせ候補" rules={results} shapes={shapes} onSelect={onSelect} />
    </div>
  );
}

function TagBlock({ title, tags }: { title: string; tags: string[] }) {
  return (
    <section className="detail-block">
      <span className="detail-label">{title}</span>
      <div className="tag-row">{tags.length ? tags.map((tag) => <span className="tag" key={tag}>{tag}</span>) : "なし"}</div>
    </section>
  );
}

function RuleBlock({ title, rules, shapes, onSelect }: { title: string; rules: EvolutionRule[]; shapes: HeadShape[]; onSelect: (id: string) => void }) {
  return (
    <section className="detail-block">
      <span className="detail-label">{title}</span>
      {rules.length === 0 ? "なし" : rules.map((rule) => <RuleSummary key={rule.id} rule={rule} shapes={shapes} onSelect={onSelect} />)}
    </section>
  );
}

function RuleSummary({ rule, shapes, onSelect }: { rule: EvolutionRule; shapes: HeadShape[]; onSelect: (id: string) => void }) {
  const parentA = shapeById(shapes, rule.parentShapeAId);
  const parentB = shapeById(shapes, rule.parentShapeBId);
  const result = shapeById(shapes, rule.resultShapeId);
  return (
    <div className="result-card">
      <h3>{parentA?.name ?? rule.parentShapeAId} + {parentB?.name ?? rule.parentShapeBId} → {result?.name ?? rule.resultShapeId}</h3>
      <p>{rule.notes}</p>
      <div className="link-list">
        {[rule.parentShapeAId, rule.parentShapeBId, rule.resultShapeId].map((id) => (
          <button className="chip-button" type="button" key={id} onClick={() => onSelect(id)}>{shapeById(shapes, id)?.name ?? id}</button>
        ))}
      </div>
    </div>
  );
}

function RuleEditor({ shapes, rules, onSave, onClose, setStatus }: { shapes: HeadShape[]; rules: EvolutionRule[]; onSave: (rules: EvolutionRule[]) => Promise<void>; onClose: () => void; setStatus: (message: string) => void }) {
  const sortedShapes = [...shapes].sort((a, b) => Number(a.gameNumber ?? 0) - Number(b.gameNumber ?? 0));
  const [parentA, setParentA] = useState(sortedShapes[0]?.id ?? "");
  const [parentB, setParentB] = useState(sortedShapes[0]?.id ?? "");
  const [result, setResult] = useState(sortedShapes[0]?.id ?? "");
  const [notes, setNotes] = useState("");

  const addRule = async () => {
    const [parentShapeAId, parentShapeBId] = orderedParentShapeIds(shapes, parentA, parentB);
    if (rules.some((rule) => rule.parentShapeAId === parentShapeAId && rule.parentShapeBId === parentShapeBId && rule.resultShapeId === result)) {
      setStatus("同じ出生元A/Bと出生先のルールがすでにあります。");
      return;
    }
    const next = [...rules, { id: nextEvolutionRuleId(rules), parentShapeAId, parentShapeBId, resultShapeId: result, notes }];
    await onSave(next);
    setNotes("");
    setStatus("進化ルールを追加して保存しました。");
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm(`${ruleId} を削除しますか？`)) return;
    await onSave(rules.filter((rule) => rule.id !== ruleId));
    setStatus(`${ruleId} を削除しました。`);
  };

  const sortAndSave = async () => {
    await onSave(sortRulesByGameNumber(rules, shapes));
    setStatus("idを維持したままgameNumber順に並び替えて保存しました。");
  };

  return (
    <Modal title="evolution-rules.json 編集" note="A/Bは保存時にgameNumber順へ自動整列します。" onClose={onClose}>
      <div className="three-col">
        <ShapeSelect label="出生元A" value={parentA} onChange={setParentA} shapes={sortedShapes} />
        <ShapeSelect label="出生元B" value={parentB} onChange={setParentB} shapes={sortedShapes} />
        <ShapeSelect label="出生先" value={result} onChange={setResult} shapes={sortedShapes} />
      </div>
      <label className="field"><span>補足</span><input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="editor-actions">
        <button className="primary-button" type="button" onClick={addRule}>登録して保存</button>
        <button className="secondary-button" type="button" onClick={sortAndSave}>並び替えて保存</button>
      </div>
      <p className="json-state">登録済み {rules.length} 件。次のID: {nextEvolutionRuleId(rules)}</p>
      <div className="rule-editor-list">
        {[...rules].reverse().map((rule) => (
          <div className="rule-row" key={rule.id}>
            <div className="rule-row-id">{rule.id}</div>
            <div className="rule-row-main">
              <strong>{shapeById(shapes, rule.parentShapeAId)?.name} + {shapeById(shapes, rule.parentShapeBId)?.name} → {shapeById(shapes, rule.resultShapeId)?.name}</strong>
              <span>{rule.notes || "補足なし"}</span>
            </div>
            <button className="danger-button" type="button" onClick={() => deleteRule(rule.id)}>削除</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FeatureEditor({ shapes, onSave, onClose, setStatus }: { shapes: HeadShape[]; onSave: (shapes: HeadShape[]) => Promise<void>; onClose: () => void; setStatus: (message: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = shapes.filter((shape) => [shape.name, shape.id, shape.gameNumber].join(" ").toLowerCase().includes(search.toLowerCase()));
  const [shapeId, setShapeId] = useState(shapes[0]?.id ?? "");
  const shape = shapeById(shapes, shapeId) ?? filtered[0];
  const [draft, setDraft] = useState<HeadShape | undefined>(shape);

  useEffect(() => setDraft(shape), [shape?.id]);

  const setValue = (group: keyof Pick<HeadShape, "statusBonus" | "elementalResistance" | "ailmentResistance" | "specialEffects">, key: string, value: number, min: number, max: number) => {
    setDraft((current) => current && { ...current, [group]: { ...current[group], [key]: Math.max(min, Math.min(max, value)) } });
  };

  const save = async () => {
    if (!draft) return;
    await onSave(shapes.map((item) => (item.id === draft.id ? normalizeHeadShape(draft) : item)));
    setStatus(`${draft.name} の特徴を保存しました。`);
  };

  return (
    <Modal title="頭の形の特徴編集" note="補正、耐性、特殊効果をフォームから更新します。" onClose={onClose}>
      <div className="two-col">
        <label className="field"><span>name検索</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="例: ハート" /></label>
        <ShapeSelect label="編集対象" value={draft?.id ?? ""} onChange={setShapeId} shapes={filtered} />
      </div>
      {draft && (
        <div className="feature-editor">
          <FeatureSection title="ステータス補正" values={draft.statusBonus} labels={statusLabels} min={-999} max={999} onChange={(key, value) => setValue("statusBonus", key, value, -999, 999)} />
          <FeatureSection title="属性耐性" values={draft.elementalResistance} labels={elementalLabels} min={-9} max={9} onChange={(key, value) => setValue("elementalResistance", key, value, -9, 9)} />
          <FeatureSection title="状態異常耐性" values={draft.ailmentResistance} labels={ailmentLabels} min={0} max={9} onChange={(key, value) => setValue("ailmentResistance", key, value, 0, 9)} />
          <FeatureSection title="特殊効果" values={draft.specialEffects} labels={specialLabels} min={-999} max={999} onChange={(key, value) => setValue("specialEffects", key, value, -999, 999)} />
        </div>
      )}
      <div className="editor-actions"><button className="primary-button" type="button" onClick={save}>保存</button></div>
    </Modal>
  );
}

function FeatureSection({ title, values, labels, min, max, onChange }: { title: string; values: Record<string, number>; labels: Record<string, string>; min: number; max: number; onChange: (key: string, value: number) => void }) {
  return (
    <section className="feature-section">
      <h3>{title}</h3>
      <div className="feature-grid">
        {Object.entries(labels).map(([key, label]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <div className="number-stepper">
              <button className="step-button" type="button" onClick={() => onChange(key, Number(values[key] ?? 0) - 1)}>-</button>
              <input type="number" min={min} max={max} value={values[key] ?? 0} onChange={(event) => onChange(key, Number(event.target.value || 0))} />
              <button className="step-button" type="button" onClick={() => onChange(key, Number(values[key] ?? 0) + 1)}>+</button>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

function JsonEditor({ shapes, onSave, onClose, setStatus }: { shapes: HeadShape[]; onSave: (shapes: HeadShape[]) => Promise<void>; onClose: () => void; setStatus: (message: string) => void }) {
  const [text, setText] = useState(JSON.stringify(shapes, null, 2));
  const save = async () => {
    const parsed = normalizeHeadShapes(JSON.parse(text));
    await onSave(parsed);
    setText(JSON.stringify(parsed, null, 2));
    setStatus("head-shapes.json を保存しました。");
  };
  return (
    <Modal title="head-shapes.json 編集" note="低レベル編集用です。通常は特徴編集UIを使います。" onClose={onClose}>
      <p className="dev-note">保存前にバックアップを作成してください。JSON構文エラーがあると保存できません。</p>
      <div className="editor-actions"><button className="primary-button" type="button" onClick={save}>保存</button></div>
      <textarea className="json-editor" value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
    </Modal>
  );
}

function ValidationModal({ shapes, rules, onClose }: { shapes: HeadShape[]; rules: EvolutionRule[]; onClose: () => void }) {
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);

  useEffect(() => {
    let active = true;
    validateProjectData(shapes, rules).then((result) => {
      if (active) setIssues(result);
    });
    return () => {
      active = false;
    };
  }, [shapes, rules]);

  const errorCount = issues?.filter((issue) => issue.severity === "error").length ?? 0;
  const warningCount = issues?.filter((issue) => issue.severity === "warning").length ?? 0;

  return (
    <Modal title="データ検証" note="公開前に標準データと画像パスの整合性を確認します。" onClose={onClose}>
      <div className="validation-summary">
        {issues === null ? (
          <span className="json-state">検証中...</span>
        ) : issues.length === 0 ? (
          <span className="validation-ok">問題は見つかりませんでした。</span>
        ) : (
          <span className="json-state">エラー {errorCount} 件 / 警告 {warningCount} 件</span>
        )}
      </div>
      <div className="validation-list">
        {issues?.map((issue, index) => (
          <div className={`validation-item ${issue.severity}`} key={`${issue.title}-${index}`}>
            <strong>{issue.severity === "error" ? "エラー" : "警告"}: {issue.title}</strong>
            <span>{issue.detail}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function BackupModal({
  shapes,
  rules,
  onRestore,
  onClose,
  setStatus,
}: {
  shapes: HeadShape[];
  rules: EvolutionRule[];
  onRestore: (backup: unknown) => Promise<void>;
  onClose: () => void;
  setStatus: (message: string) => void;
}) {
  const [restoreState, setRestoreState] = useState("");

  const exportBackup = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      headShapes: shapes.map(serializeHeadShape),
      evolutionRules: normalizeEvolutionRules(rules),
    };
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `denpa-head-tool-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!confirm("現在の head-shapes.json と evolution-rules.json をバックアップ内容で上書きします。続行しますか？")) return;
      await onRestore(parsed);
      setRestoreState(file.name);
      setStatus("バックアップを復元しました。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Modal title="バックアップ/復元" note="標準データ編集前後の退避と復元に使います。" onClose={onClose}>
      <div className="editor-actions">
        <button className="primary-button" type="button" onClick={exportBackup}>バックアップを書き出す</button>
        <label className="secondary-button file-button">
          バックアップを復元
          <input type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} />
        </label>
      </div>
      <p className="dev-note">復元すると現在の標準データJSONを上書きします。必要に応じて先に書き出してください。</p>
      {restoreState && <p className="json-state">復元元: {restoreState}</p>}
    </Modal>
  );
}

function ShapeSelect({ label, value, onChange, shapes }: { label: string; value: string; onChange: (id: string) => void; shapes: HeadShape[] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {shapes.map((shape) => <option key={shape.id} value={shape.id}>{shape.gameNumber ?? "-"} {shape.name}</option>)}
      </select>
    </label>
  );
}

function Modal({ title, note, children, onClose }: { title: string; note: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal wide-modal" role="dialog" aria-modal="true">
        <div className="modal-form">
          <div className="modal-heading">
            <div><h2>{title}</h2><p className="dev-note">{note}</p></div>
            <button className="icon-button small" type="button" onClick={onClose}>x</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
