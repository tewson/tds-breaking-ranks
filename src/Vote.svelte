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
  .vote {
    padding-bottom: 1rem;
    border-bottom: 2px solid #dbdbdb;
    margin-bottom: 2rem;
  }
  .party {
    word-break: break-all;
  }
</style>

<main>
  <div class="vote">
    <h2 class="title is-5">{vote.debateTitle}</h2>
    <h3 class="subtitle is-6">{vote.subject}</h3>
    <p>
      <label class="label is-inline">Outcome:</label>
      {vote.outcome}
    </p>
    <table class="table is-fullwidth">
      <thead>
        <tr>
          <th class="party">Party</th>
          <th>Tá</th>
          <th>Staon</th>
          <th>Níl</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedTalliesByParty as { breakingRanks, partyCode, taVotes, staonVotes, nilVotes }}
          <tr class:has-background-warning={breakingRanks}>
            <td class="party">{vote.partyLookup[partyCode].showAs}</td>
            <td>{taVotes.length}</td>
            <td>{staonVotes.length}</td>
            <td>{nilVotes.length}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot class="has-text-weight-bold">
        <tr>
          <td>Total</td>
          <td>{vote.tallies.taVotes.tally}</td>
          <td>{vote.tallies.staonVotes.tally}</td>
          <td>{vote.tallies.nilVotes.tally}</td>
        </tr>
      </tfoot>
    </table>
    <div>
      <div class="pb-4">
        <label class="checkbox">
          <input type="checkbox" bind:checked={memberBreakingRanksShown} />
          Show votes against party
        </label>
      </div>
      {#if memberBreakingRanksShown}
        {#each Object.keys(vote.talliesByParty) as partyCode}
          {#if vote.breakingRanksPartyCodes.includes(partyCode) && partyCode !== 'Independent'}
            <div class="box mb-5">
              <h4 class="title is-6">{partyCode}</h4>
              {#if vote.talliesByParty[partyCode].taVotes.length > 0}
                <h5 class="title is-6">Tá</h5>
                <div class="content">
                  {vote.talliesByParty[partyCode].taVotes
                    .map(m => m.fullName)
                    .join(', ')}
                </div>
              {/if}
              {#if vote.talliesByParty[partyCode].staonVotes.length > 0}
                <h5 class="title is-6">Staon</h5>
                <div class="content">
                  {vote.talliesByParty[partyCode].staonVotes
                    .map(m => m.fullName)
                    .join(', ')}
                </div>
              {/if}
              {#if vote.talliesByParty[partyCode].nilVotes.length > 0}
                <h5 class="title is-6">Níl</h5>
                <div class="content">
                  {vote.talliesByParty[partyCode].nilVotes
                    .map(m => m.fullName)
                    .join(', ')}
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
    <a
      href={`https://www.oireachtas.ie/en/debates/vote/dail/${vote.dailTerm}/${vote.date}/${vote.id}/`}>
      View details on oireachtas.ie
    </a>
  </div>
</main>
