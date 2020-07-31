<script lang="ts">
  import type { Vote } from "./api";
  import { fetchVotes } from "./api";

  let votes: Vote[] = [];

  async function init() {
    votes = await fetchVotes();
  }

  init();
</script>

<main>
  <h1>Breaking Ranks</h1>
  {#each votes as vote}
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
          {#each Object.keys(vote.talliesByParty) as partyCode}
            <tr>
              <td>{partyCode}</td>
              <td>{vote.talliesByParty[partyCode].taVotes}</td>
              <td>{vote.talliesByParty[partyCode].staonVotes}</td>
              <td>{vote.talliesByParty[partyCode].nilVotes}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
</main>
