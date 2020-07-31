<script lang="ts">
  import type { Vote } from "./api";

  export let vote: Vote;

  $: sortedTalliesByParty = Object.keys(vote.talliesByParty)
    .sort((a, b) => a.localeCompare(b))
    .map(partyCode => ({
      ...vote.talliesByParty[partyCode],
      partyCode,
      breakingRanks:
        vote.breakingRanksPartyCodes.includes(partyCode) &&
        partyCode !== "Independent"
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
