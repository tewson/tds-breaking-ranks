interface Party {
  partyCode: string;
}

interface PartyWrapper {
  party: Party;
}

interface Membership {
  parties: PartyWrapper[];
}

interface MembershipWrapper {
  membership: Membership;
}

export interface Member {
  uri: string;
  fullName: string;
  memberships: MembershipWrapper[];
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

interface MemberPartyMap {
  [memberUri: string]: string;
}

const apiPrefix = "https://api.oireachtas.ie/v1";

function stringifyQueryParams(params: { [key: string]: string | number }) {
  return Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

export async function fetchMembers(): Promise<Member[]> {
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/33`,
    limit: 10000
  };
  const url = `${apiPrefix}/members?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const { results } = await response.json();
  return results.map((result: MemberApiResult) => result.member);
}

function getMemberCurrentPartyCode(member: Member): string {
  const currentMembership = member.memberships.slice(-1).pop()?.membership;
  const currentParty = currentMembership?.parties.slice(-1).pop()?.party;
  return currentParty?.partyCode ?? "";
}

export async function fetchVotes(): Promise<Vote[]> {
  const members = await fetchMembers();
  const memberPartyMap = members.reduce((acc, member) => {
    const partyCode = getMemberCurrentPartyCode(member);
    return {
      ...acc,
      [member.uri]: partyCode
    };
  }, {} as MemberPartyMap);

  console.log(memberPartyMap);

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
