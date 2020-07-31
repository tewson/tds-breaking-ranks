<script lang="ts">
  import type { Member, Vote } from "./api";
  import { fetchMembers, fetchVotes } from "./api";

  let members: Member[] = [];
  let votes: Vote[] = [];

  async function init() {
    members = await fetchMembers();
    votes = await fetchVotes();
  }

  init();
</script>

<main>
  <h1>Breaking Ranks</h1>
  <ul>
    {#each members as member}
      <li>{member.fullName}</li>
    {/each}
  </ul>
  {#each votes as vote}
    <div>
      <h1>{vote.debateTitle}</h1>
      <h2>{vote.subject}</h2>
    </div>
  {/each}
</main>
