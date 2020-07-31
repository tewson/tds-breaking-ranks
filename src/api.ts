const apiPrefix = "https://api.oireachtas.ie/v1";

function stringifyQueryParams(params: { [key: string]: string | number }) {
  return Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

export async function fetchMembers() {
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/33`,
    limit: 10000
  };
  const url = `${apiPrefix}/members?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const { results } = await response.json();
  return results.map((result: any) => result.member);
}

export async function fetchVotes() {
  await fetchMembers();
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/33`,
    limit: 10000
  };
  const url = `${apiPrefix}/divisions?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const { results } = await response.json();
  return results.map((result: any) => result.division.subject.showAs);
}
