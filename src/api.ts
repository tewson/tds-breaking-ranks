interface Party {
  partyCode: string;
  showAs: string;
}

interface PartyWrapper {
  party: Party;
}

interface Membership {
  parties: PartyWrapper[];
  house: {
    houseNo: string;
  };
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

interface TallyMember {
  fullName: string;
}

type TallyDetails = {
  [tallyType in TallyType]: TallyMember[];
};

interface TalliesByParty {
  [partyCode: string]: TallyDetails;
}

export interface Vote {
  dailTerm: string;
  date: string;
  id: string;
  debateTitle: string;
  subject: string;
  talliesByParty: TalliesByParty;
  breakingRanksPartyCodes: string[];
  partyLookup: PartyLookupMap;
  outcome: string;
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
    date: string;
    voteId: string;
    debate: {
      showAs: string;
    };
    subject: {
      showAs: string;
    };
    tallies: VoteTallies;
    outcome: string;
  };
}

interface MemberLookupMap {
  [memberUri: string]: {
    fullName: string;
    partyCode: string;
  };
}

interface PartyLookupMap {
  [partyCode: string]: Party;
}

const apiPrefix = "https://api.oireachtas.ie/v1";

function stringifyQueryParams(params: { [key: string]: string | number }) {
  return Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

export async function fetchMembers(term: string): Promise<Member[]> {
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/${term}`,
    limit: 10000
  };
  const url = `${apiPrefix}/members?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const { results } = await response.json();
  return results.map((result: MemberApiResult) => result.member);
}

async function fetchParties(term: string): Promise<Party[]> {
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/${term}`,
    limit: 10000
  };
  const url = `${apiPrefix}/parties?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const {
    results: {
      house: { parties }
    }
  } = await response.json();
  return parties.map((result: PartyWrapper) => result.party);
}

function getMemberPartyCodeAtVoteTime(member: Member, term: string): string {
  const membershipAtVoteTime = member.memberships.find(
    membershipWrapper => membershipWrapper.membership.house.houseNo === term
  )?.membership;
  const currentParty = membershipAtVoteTime?.parties.slice(-1).pop()?.party;
  return currentParty?.partyCode ?? "";
}

function hasBreakingRanks(tallyCounts: TallyDetails) {
  const tallySum = Object.keys(tallyCounts).reduce((acc, tallyType) => {
    return acc + tallyCounts[tallyType as TallyType].length;
  }, 0);

  return Object.keys(tallyCounts).reduce((acc, tallyType) => {
    return (
      acc ||
      (tallyCounts[tallyType as TallyType].length !== 0 &&
        tallyCounts[tallyType as TallyType].length !== tallySum)
    );
  }, false);
}

export async function fetchVotes(term: string): Promise<Vote[]> {
  const members = await fetchMembers(term);
  const parties = await fetchParties(term);
  const params = {
    chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/${term}`,
    limit: 10000
  };
  const url = `${apiPrefix}/divisions?${stringifyQueryParams(params)}`;
  const response = await fetch(url);
  const { results: voteResults } = await response.json();

  const memberLookup = members.reduce((acc, member) => {
    const partyCode = getMemberPartyCodeAtVoteTime(member, term);
    return {
      ...acc,
      [member.uri]: {
        fullName: member.fullName,
        partyCode
      }
    };
  }, {} as MemberLookupMap);

  const partyLookup = parties.reduce((acc, party) => {
    return {
      ...acc,
      [party.partyCode]: party
    };
  }, {} as PartyLookupMap);

  function getVoteTalliesByParty(tallies: VoteTallies) {
    let talliesByParty: TalliesByParty = {};

    [TallyType.Ta, TallyType.Staon, TallyType.Nil].forEach(tallyType => {
      const tallyMembers = tallies[tallyType]?.members ?? [];
      tallyMembers.forEach(memberWrapper => {
        const tallyMember = memberLookup[memberWrapper.member.uri];
        if (tallyMember) {
          if (talliesByParty[tallyMember.partyCode]) {
            talliesByParty[tallyMember.partyCode][tallyType].push(tallyMember);
          } else {
            talliesByParty[tallyMember.partyCode] = {
              [TallyType.Ta]: [],
              [TallyType.Nil]: [],
              [TallyType.Staon]: []
            };

            talliesByParty[tallyMember.partyCode][tallyType] = [tallyMember];
          }
        }
      });
    });

    return talliesByParty;
  }

  return voteResults.map((result: VoteApiResult) => {
    const talliesByParty = getVoteTalliesByParty(result.division.tallies);
    const breakingRanksPartyCodes = Object.keys(
      talliesByParty
    ).filter(partyCode => hasBreakingRanks(talliesByParty[partyCode]));

    return {
      dailTerm: term,
      date: result.division.date,
      id: result.division.voteId.replace("vote_", ""),
      debateTitle: result.division.debate.showAs,
      subject: result.division.subject.showAs,
      talliesByParty,
      breakingRanksPartyCodes,
      partyLookup, // This is awful but hey it works.
      outcome: result.division.outcome
    } as Vote;
  });
}
