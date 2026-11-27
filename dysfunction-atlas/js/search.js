function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function searchDysfunctions(query, { dysfunctions, regions }) {
  const q = normalize(query);
  if (!q) return [];

  const regionLabel = (id) => regions.find((r) => r.id === id)?.label || "";

  return dysfunctions
    .map((d) => {
      const hay = normalize(
        [
          d.namePopular,
          d.nameTechnical,
          d.summary,
          ...(d.aliases || []),
          ...(d.signs || []),
          regionLabel(d.regionId),
        ].join(" "),
      );
      const score =
        (normalize(d.namePopular).includes(q) ? 40 : 0) +
        (normalize(d.nameTechnical).includes(q) ? 25 : 0) +
        ((d.aliases || []).some((a) => normalize(a).includes(q)) ? 30 : 0) +
        (hay.includes(q) ? 10 : 0);
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}
