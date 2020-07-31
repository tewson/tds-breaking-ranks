export interface Member {
  fullName: string;
}

interface MemberApiResult {
  member: Member;
}

export interface Vote {
  debateTitle: string;
  subject: string;
}

interface VoteApiResult {
  division: {
    debate: {
      showAs: string;
    };
    subject: {
      showAs: string;
    };
  };
}

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
  return results.map((result: MemberApiResult) => result.member);
}

export async function fetchVotes(): Promise<Vote[]> {
  await fetchMembers();
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/33`,
    limit: 10000
  };
  const url = `${apiPrefix}/divisions?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const { results } = await response.json();
  return results.map((result: VoteApiResult) => {
    return {
      debateTitle: result.division.debate.showAs,
      subject: result.division.subject.showAs
    } as Vote;
  });
}
