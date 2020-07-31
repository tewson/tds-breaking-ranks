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

interface TalliesByParty {
  [partyCode: string]: {
    taVotes: number;
    nilVotes: number;
    staonVotes: number;
  };
}

export interface Vote {
  debateTitle: string;
  subject: string;
  talliesByParty: TalliesByParty;
}

interface VoteTally {
  members: [
    {
      member: {
        uri: string;
      };
    }
  ];
  tally: number;
}

interface VoteTallies {
  staonVotes: VoteTally;
  nilVotes: VoteTally;
  taVotes: VoteTally;
}

interface VoteApiResult {
  division: {
    debate: {
      showAs: string;
    };
    subject: {
      showAs: string;
    };
    tallies: VoteTallies;
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

  function getVoteTalliesByParty(tallies: VoteTallies) {
    const initialTallies = {
      staonVotes: 0,
      nilVotes: 0,
      taVotes: 0
    };

    let talliesByParty: TalliesByParty = {};

    tallies.staonVotes.members.forEach(memberWrapper => {
      const memberPartyCode = memberPartyMap[memberWrapper.member.uri];
      if (talliesByParty[memberPartyCode]) {
        talliesByParty[memberPartyCode].staonVotes++;
      } else {
        talliesByParty[memberPartyCode] = {
          ...initialTallies,
          staonVotes: 1
        };
      }
    });

    tallies.nilVotes.members.forEach(memberWrapper => {
      const memberPartyCode = memberPartyMap[memberWrapper.member.uri];
      if (talliesByParty[memberPartyCode]) {
        talliesByParty[memberPartyCode].nilVotes++;
      } else {
        talliesByParty[memberPartyCode] = {
          ...initialTallies,
          nilVotes: 1
        };
      }
    });

    tallies.taVotes.members.forEach(memberWrapper => {
      const memberPartyCode = memberPartyMap[memberWrapper.member.uri];
      if (talliesByParty[memberPartyCode]) {
        talliesByParty[memberPartyCode].taVotes++;
      } else {
        talliesByParty[memberPartyCode] = {
          ...initialTallies,
          taVotes: 1
        };
      }
    });

    return talliesByParty;
  }

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
      subject: result.division.subject.showAs,
      talliesByParty: getVoteTalliesByParty(result.division.tallies)
    } as Vote;
  });
}
