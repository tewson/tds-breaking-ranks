<script lang="ts">
  import type { Vote, TallyType, TallyCounts } from "./api";

  export let vote: Vote;

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

  $: sortedTalliesByParty = Object.keys(vote.talliesByParty)
    .sort((a, b) => a.localeCompare(b))
    .map(partyCode => ({
      ...vote.talliesByParty[partyCode],
      partyCode,
      breakingRanks:
        partyCode !== "Independent" &&
        hasBreakingRanks(vote.talliesByParty[partyCode])
    }));
</script>

<style>
  .breaking-ranks {
    background: red;
  }
</style>

<main>
  <div>
    <h1>{vote.debateTitle}</h1>
    <h2>{vote.subject}</h2>
    <table>
      <thead>
        <tr>
          <th>Party</th>
          <th>Tá</th>
          <th>Staon</th>
          <th>Níl</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedTalliesByParty as { breakingRanks, partyCode, taVotes, staonVotes, nilVotes }}
          <tr class:breaking-ranks={breakingRanks}>
            <td>{partyCode}</td>
            <td>{taVotes}</td>
            <td>{staonVotes}</td>
            <td>{nilVotes}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>
