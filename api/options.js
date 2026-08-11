import { dateCondition, fetchAll } from "../lib/auction-api.js";

const MARKETS = [
  "서울가락", "서울강서", "수원", "안양", "안산", "구리", "인천남촌", "인천삼산",
  "순천", "광주각화", "광주서부", "정읍", "익산", "전주", "대전오정", "대전노은",
  "청주", "충주", "천안", "춘천", "강릉", "원주", "부산엄궁", "부산반여", "대구북부",
  "울산", "진주", "창원팔용", "창원내서",
];

export default async function handler(req, res) {
  try {
    const date = String(req.query.date || kstToday());
    const market = String(req.query.market || "").trim();
    if (!market) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).json({ markets: MARKETS, corps: [] });
    }
    const params = { ...dateCondition(date), selectable: "corp_nm" };
    params["cond[whsl_mrkt_nm::EQ]"] = market;
    const { rows } = await fetchAll(params);
    const corps = [...new Set(rows.map((row) => row.corp_nm).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    res.status(200).json({ markets: MARKETS, corps });
  } catch (error) {
    res.status(502).json({ error: error.message || "선택 항목을 불러오지 못했습니다." });
  }
}

function kstToday() { return new Date(Date.now() + 32400000).toISOString().slice(0, 10); }
