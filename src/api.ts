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

enum TallyType {
  Staon = "staonVotes",
  Ta = "taVotes",
  Nil = "nilVotes"
}

type TallyCounts = {
  [tallyType in TallyType]: number;
};

interface TalliesByParty {
  [partyCode: string]: TallyCounts;
}

export interface Vote {
  debateTitle: string;
  subject: string;
  talliesByParty: TalliesByParty;
  breakingRanksPartyCodes: string[];
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

type VoteTallies = {
  [tallyType in TallyType]: VoteTally;
};

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

function hasBreakingRanks(tallyCounts: TallyCounts) {
  const tallySum = Object.keys(tallyCounts).reduce((acc, tallyType) => {
    return acc + tallyCounts[tallyType as TallyType];
  }, 0);

  return Object.keys(tallyCounts).reduce((acc, tallyType) => {
    return (
      acc ||
      (tallyCounts[tallyType as TallyType] !== 0 &&
        tallyCounts[tallyType as TallyType] !== tallySum)
    );
  }, false);
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
      [TallyType.Ta]: 0,
      [TallyType.Nil]: 0,
      [TallyType.Staon]: 0
    };

    let talliesByParty: TalliesByParty = {};

    [TallyType.Ta, TallyType.Staon, TallyType.Nil].forEach(tallyType => {
      tallies[tallyType].members.forEach(memberWrapper => {
        const memberPartyCode = memberPartyMap[memberWrapper.member.uri];
        if (talliesByParty[memberPartyCode]) {
          talliesByParty[memberPartyCode][tallyType]++;
        } else {
          talliesByParty[memberPartyCode] = {
            ...initialTallies,
            [tallyType]: 1
          };
        }
      });
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
    const talliesByParty = getVoteTalliesByParty(result.division.tallies);
    const breakingRanksPartyCodes = Object.keys(
      talliesByParty
    ).filter(partyCode => hasBreakingRanks(talliesByParty[partyCode]));

    return {
      debateTitle: result.division.debate.showAs,
      subject: result.division.subject.showAs,
      talliesByParty,
      breakingRanksPartyCodes
    } as Vote;
  });
}
