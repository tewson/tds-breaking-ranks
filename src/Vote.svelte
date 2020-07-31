<script lang="ts">
  import type { Vote } from "./api";

  export let vote: Vote;

  $: sortedTalliesByParty = Object.keys(vote.talliesByParty)
    .sort((a, b) => a.localeCompare(b))
    .map(partyCode => ({
      ...vote.talliesByParty[partyCode],
      partyCode
    }));
</script>

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
        {#each sortedTalliesByParty as partyTally}
          <tr>
            <td>{partyTally.partyCode}</td>
            <td>{partyTally.taVotes}</td>
            <td>{partyTally.staonVotes}</td>
            <td>{partyTally.nilVotes}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>
