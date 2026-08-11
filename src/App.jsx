import { useEffect, useMemo, useState } from "react";

const today = () => new Date(Date.now() + 32400000).toISOString().slice(0, 10);
const compactDate = (value) => value.replaceAll("-", "");
const number = (value) => Number(value || 0).toLocaleString("ko-KR");
const LARGE = ["과실류", "과일과채류", "과채류", "관엽식물류", "근채류", "농림가공", "농산물종자류", "두류", "버섯류", "산채류", "서류", "수산가공", "수실류", "신선 해조류", "약용작물류", "양채류", "엽경채류", "잡곡류", "조미채소류", "초화류", "특용작물류", "활 해면어류"];

export default function App() {
  const [date, setDate] = useState(today());
  const [markets, setMarkets] = useState([]);
  const [corps, setCorps] = useState([]);
  const [tree, setTree] = useState(null);
  const [choice, setChoice] = useState({ market: "", corp: "", large: "", medium: "", small: "" });
  const [modal, setModal] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    fetch(`/api/options?date=${date}`).then(readJson).then((data) => setMarkets(data.markets || [])).catch(() => setMarkets([]));
  }, [date]);

  const open = async (type) => {
    if (type === "corp" && !choice.market) return setModal({ title: "도매법인", message: "도매시장을 먼저 선택하세요.", options: [] });
    if ((type === "medium" || type === "small") && !choice.large) return setModal({ title: type === "medium" ? "품목" : "품종", message: "부류를 먼저 선택하세요.", options: [] });
    if (type === "small" && !choice.medium) return setModal({ title: "품종", message: "품목을 먼저 선택하세요.", options: [] });
    if (type === "corp" && !corps.length) {
      setLoadingOptions(true);
      try {
        const data = await fetch(`/api/options?date=${date}&market=${encodeURIComponent(choice.market)}`).then(readJson);
        setCorps(data.corps || []);
        setModal({ title: "도매법인", type, options: data.corps || [] });
      } catch (e) { setModal({ title: "도매법인", message: e.message, options: [] }); }
      finally { setLoadingOptions(false); }
      return;
    }
    if (type === "large") return setModal({ title: "부류", type, options: LARGE });
    if (type === "market") return setModal({ title: "도매시장", type, options: markets });
    if (type === "corp") return setModal({ title: "도매법인", type, options: corps });
    let selectedTree = tree;
    if (!selectedTree || selectedTree.name !== choice.large) {
      setLoadingOptions(true);
      try {
        const data = await fetch(`/api/categories?date=${date}&lclsfName=${encodeURIComponent(choice.large)}`).then(readJson);
        selectedTree = (data.categories || []).find((x) => x.name === choice.large) || data.categories?.[0];
        setTree(selectedTree);
      } catch (e) { setModal({ title: type === "medium" ? "품목" : "품종", message: e.message, options: [] }); setLoadingOptions(false); return; }
      setLoadingOptions(false);
    }
    if (type === "medium") return setModal({ title: "품목", type, options: selectedTree?.children?.map((x) => x.name) || [] });
    const medium = selectedTree?.children?.find((x) => x.name === choice.medium);
    setModal({ title: "품종", type, options: medium?.children?.map((x) => x.name) || [] });
  };

  const select = (type, value) => {
    setChoice((old) => ({
      ...old, [type]: value,
      ...(type === "market" ? { corp: "" } : {}),
      ...(type === "large" ? { medium: "", small: "" } : {}),
      ...(type === "medium" ? { small: "" } : {}),
    }));
    if (type === "market") setCorps([]);
    if (type === "large") setTree(null);
    setModal(null);
  };

  const selectedNodes = useMemo(() => {
    const large = tree?.name === choice.large ? tree : null;
    const medium = large?.children?.find((x) => x.name === choice.medium);
    const small = medium?.children?.find((x) => x.name === choice.small);
    return { large, medium, small };
  }, [tree, choice.large, choice.medium, choice.small]);

  const runSearch = async () => {
    let currentTree = tree;
    if (choice.large && (!currentTree || currentTree.name !== choice.large)) {
      setLoadingOptions(true);
      try {
        const data = await fetch(`/api/categories?date=${date}&lclsfName=${encodeURIComponent(choice.large)}`).then(readJson);
        currentTree = (data.categories || []).find((x) => x.name === choice.large) || data.categories?.[0] || null;
        setTree(currentTree);
      } catch (e) {
        setModal({ title: "검색", message: e.message, options: [] });
        setLoadingOptions(false);
        return;
      }
      setLoadingOptions(false);
    }
    const medium = currentTree?.children?.find((x) => x.name === choice.medium);
    const small = medium?.children?.find((x) => x.name === choice.small);
    setSubmitted({
      market: choice.market, corp: choice.corp,
      lclsf: currentTree?.code, mclsf: medium?.code, sclsf: small?.code,
      includeUnclassified: small?.includeUnclassified ? "1" : "",
    });
    setSearchKey((x) => x + 1);
  };

  return <main className="classic-app">
    <ResultTable key={searchKey} date={date} filters={submitted || {}} active={Boolean(submitted)} />
    <div className="control-dock">
      <div className="control-grid">
        <button className="date-control"><input aria-label="날짜" type="date" value={date} max={today()} onChange={(e) => { setDate(e.target.value); setSubmitted(null); }} /><b>{compactDate(date)}</b></button>
        <FilterButton label="도매시장" value={choice.market} count={markets.length} onClick={() => open("market")} />
        <FilterButton label="도매법인" value={choice.corp} count={corps.length} onClick={() => open("corp")} />
        <FilterButton label="부류" value={choice.large} count={LARGE.length} onClick={() => open("large")} />
        <FilterButton label="품목" value={choice.medium} count={selectedNodes.large?.children?.length} onClick={() => open("medium")} />
        <FilterButton label="품종" value={choice.small} count={selectedNodes.medium?.children?.length} onClick={() => open("small")} />
      </div>
      <button className="search-button" onClick={runSearch}>검색</button>
    </div>
    {loadingOptions && <div className="option-loading">목록 불러오는 중…</div>}
    {modal && <OptionModal {...modal} selected={modal.type ? choice[modal.type] : ""} onSelect={(value) => select(modal.type, value)} onClose={() => setModal(null)} />}
  </main>;
}

function FilterButton({ label, value, count, onClick }) {
  return <button className={value ? "filter selected" : "filter"} onClick={onClick}>{value || label}{count ? ` (${count})` : ""}</button>;
}

function OptionModal({ title, options = [], selected, message, onSelect, onClose }) {
  return <div className="modal-shade" onMouseDown={onClose}><section className="option-modal" onMouseDown={(e) => e.stopPropagation()}>
    <h2>{title}</h2>
    {message && <p className="modal-message">{message}</p>}
    <div className="option-list">{options.map((option) => <label key={option}><input type="radio" name={title} checked={selected === option} onChange={() => onSelect(option)} /><span>{option}</span></label>)}</div>
    <button className="close-modal" onClick={onClose}>닫기</button>
  </section></div>;
}

function ResultTable({ date, filters, active }) {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "datetime", direction: "desc" });

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ date, page: String(page), size: "100" });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    fetch(`/api/trades?${params}`, { signal: controller.signal }).then(readJson)
      .then((result) => { setData(result); setItems((old) => page ? [...old, ...(result.trades || [])] : result.trades || []); })
      .catch((e) => e.name !== "AbortError" && setError(e.message)).finally(() => setLoading(false));
    return () => controller.abort();
  }, [active, date, JSON.stringify(filters), page]);

  const sorted = useMemo(() => [...items].sort((a, b) => {
    const av = a[sort.key] ?? "", bv = b[sort.key] ?? "";
    const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "ko");
    return sort.direction === "asc" ? result : -result;
  }), [items, sort]);
  const changeSort = (key) => setSort((old) => ({ key, direction: old.key === key && old.direction === "desc" ? "asc" : "desc" }));

  return <section className="result-area">
    <div className="table-head">
      <button onClick={() => changeSort("datetime")}>경매시간</button><button onClick={() => changeSort("item")}>품목</button><span>산지</span><button onClick={() => changeSort("quantity")}>거래량</button><button onClick={() => changeSort("unit")}>규격</button><button className={sort.key === "price" ? "active" : ""} onClick={() => changeSort("price")}>경락가</button>
    </div>
    {!active && <div className="blank-state">아래에서 조건을 고른 뒤<br/><b>검색</b>을 누르세요.</div>}
    {loading && !items.length && <div className="blank-state">전체 자료를 확인하는 중입니다…</div>}
    {error && <div className="blank-state error-text">{error}</div>}
    <div className="table-body">{sorted.map((row, index) => <article className="table-row" key={`${row.datetime}-${index}`}>
      <time>{formatDateTime(row.datetime)}</time><strong>{row.variety || row.item}</strong><span>{formatOrigin(row.origin)}</span><span>{number(row.quantity)}</span><span>{row.unit || "-"}</span><b>{number(row.price)}원</b>
    </article>)}</div>
    {!loading && items.length < (data?.count || 0) && <button className="more" onClick={() => setPage((x) => x + 1)}>더 보기 ({items.length}/{number(data.count)})</button>}
  </section>;
}

function formatDateTime(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 12) return value || "-";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}\n${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14) || "00"}`;
}
function formatOrigin(value) { return String(value || "-").replaceAll(" ", "\n"); }
async function readJson(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `서버 오류 ${response.status}`); return data; }
