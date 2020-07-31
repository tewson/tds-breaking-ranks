<script lang="ts">
  import type { Vote } from "./api";

  export let vote: Vote;
  let memberBreakingRanksShown = false;

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
            <td>{taVotes.length}</td>
            <td>{staonVotes.length}</td>
            <td>{nilVotes.length}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div>
      <div>
        <label>
          <input type="checkbox" bind:checked={memberBreakingRanksShown} />
          Show votes against party
        </label>
      </div>
      {#if memberBreakingRanksShown}
        {#each Object.keys(vote.talliesByParty) as partyCode}
          {#if vote.breakingRanksPartyCodes.includes(partyCode) && partyCode !== 'Independent'}
            <div>
              <h3>{partyCode}</h3>
              {#if vote.talliesByParty[partyCode].taVotes.length > 0}
                <h4>Tá</h4>
                <p>
                  {vote.talliesByParty[partyCode].taVotes
                    .map(m => m.fullName)
                    .join(', ')}
                </p>
              {/if}
              {#if vote.talliesByParty[partyCode].staonVotes.length > 0}
                <h4>Staon</h4>
                <p>
                  {vote.talliesByParty[partyCode].staonVotes
                    .map(m => m.fullName)
                    .join(', ')}
                </p>
              {/if}
              {#if vote.talliesByParty[partyCode].nilVotes.length > 0}
                <h4>Níl</h4>
                <p>
                  {vote.talliesByParty[partyCode].nilVotes
                    .map(m => m.fullName)
                    .join(', ')}
                </p>
              {/if}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
    <a
      href={`https://www.oireachtas.ie/en/debates/vote/dail/${vote.dailTerm}/${vote.date}/${vote.id}/`}>
      View detailed results
    </a>
  </div>
</main>
