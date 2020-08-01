var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    var TallyType;
    (function (TallyType) {
        TallyType["Staon"] = "staonVotes";
        TallyType["Ta"] = "taVotes";
        TallyType["Nil"] = "nilVotes";
    })(TallyType || (TallyType = {}));
    const apiPrefix = "https://api.oireachtas.ie/v1";
    function stringifyQueryParams(params) {
        return Object.keys(params)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join("&");
    }
    function fetchMembers(term) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {
                chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/${term}`,
                limit: 10000
            };
            const url = `${apiPrefix}/members?${stringifyQueryParams(params)}`;
            const response = yield fetch(url);
            const { results } = yield response.json();
            return results.map((result) => result.member);
        });
    }
    function fetchParties(term) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {
                chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/${term}`,
                limit: 10000
            };
            const url = `${apiPrefix}/parties?${stringifyQueryParams(params)}`;
            const response = yield fetch(url);
            const { results: { house: { parties } } } = yield response.json();
            return parties.map((result) => result.party);
        });
    }
    function getMemberPartyCodeAtVoteTime(member, term) {
        var _a, _b, _c;
        const membershipAtVoteTime = (_a = member.memberships.find(membershipWrapper => membershipWrapper.membership.house.houseNo === term)) === null || _a === void 0 ? void 0 : _a.membership;
        const currentParty = (_b = membershipAtVoteTime === null || membershipAtVoteTime === void 0 ? void 0 : membershipAtVoteTime.parties.slice(-1).pop()) === null || _b === void 0 ? void 0 : _b.party;
        return (_c = currentParty === null || currentParty === void 0 ? void 0 : currentParty.partyCode) !== null && _c !== void 0 ? _c : "";
    }
    function hasBreakingRanks(tallyCounts) {
        const tallySum = Object.keys(tallyCounts).reduce((acc, tallyType) => {
            return acc + tallyCounts[tallyType].length;
        }, 0);
        return Object.keys(tallyCounts).reduce((acc, tallyType) => {
            return (acc ||
                (tallyCounts[tallyType].length !== 0 &&
                    tallyCounts[tallyType].length !== tallySum));
        }, false);
    }
    function fetchVotes(term) {
        return __awaiter(this, void 0, void 0, function* () {
            const members = yield fetchMembers(term);
            const parties = yield fetchParties(term);
            const params = {
                chamber_id: `https://data.oireachtas.ie/ie/oireachtas/house/dail/${term}`,
                limit: 10000
            };
            const url = `${apiPrefix}/divisions?${stringifyQueryParams(params)}`;
            const response = yield fetch(url);
            const { results: voteResults } = yield response.json();
            const memberLookup = members.reduce((acc, member) => {
                const partyCode = getMemberPartyCodeAtVoteTime(member, term);
                return Object.assign(Object.assign({}, acc), { [member.uri]: {
                        fullName: member.fullName,
                        partyCode
                    } });
            }, {});
            const partyLookup = parties.reduce((acc, party) => {
                return Object.assign(Object.assign({}, acc), { [party.partyCode]: party });
            }, {});
            function getVoteTalliesByParty(tallies) {
                let talliesByParty = {};
                [TallyType.Ta, TallyType.Staon, TallyType.Nil].forEach(tallyType => {
                    var _a, _b;
                    const tallyMembers = (_b = (_a = tallies[tallyType]) === null || _a === void 0 ? void 0 : _a.members) !== null && _b !== void 0 ? _b : [];
                    tallyMembers.forEach(memberWrapper => {
                        const tallyMember = memberLookup[memberWrapper.member.uri];
                        if (tallyMember) {
                            if (talliesByParty[tallyMember.partyCode]) {
                                talliesByParty[tallyMember.partyCode][tallyType].push(tallyMember);
                            }
                            else {
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
            return voteResults.map((result) => {
                const talliesByParty = getVoteTalliesByParty(result.division.tallies);
                const breakingRanksPartyCodes = Object.keys(talliesByParty).filter(partyCode => hasBreakingRanks(talliesByParty[partyCode]));
                return {
                    dailTerm: term,
                    date: result.division.date,
                    id: result.division.voteId.replace("vote_", ""),
                    debateTitle: result.division.debate.showAs,
                    subject: result.division.subject.showAs,
                    tallies: result.division.tallies,
                    talliesByParty,
                    breakingRanksPartyCodes,
                    partyLookup,
                    outcome: result.division.outcome
                };
            });
        });
    }

    /* src/Vote.svelte generated by Svelte v3.24.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i].breakingRanks;
    	child_ctx[4] = list[i].partyCode;
    	child_ctx[8] = list[i].taVotes;
    	child_ctx[9] = list[i].staonVotes;
    	child_ctx[10] = list[i].nilVotes;
    	return child_ctx;
    }

    // (39:8) {#each sortedTalliesByParty as { breakingRanks, partyCode, taVotes, staonVotes, nilVotes }}
    function create_each_block_1(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*vote*/ ctx[0].partyLookup[/*partyCode*/ ctx[4]].showAs + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*taVotes*/ ctx[8].length + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*staonVotes*/ ctx[9].length + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6_value = /*nilVotes*/ ctx[10].length + "";
    	let t6;
    	let t7;

    	return {
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td3 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			attr(td0, "class", "party svelte-1fdo21a");
    			toggle_class(tr, "has-background-warning", /*breakingRanks*/ ctx[7]);
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    			append(tr, td2);
    			append(td2, t4);
    			append(tr, t5);
    			append(tr, td3);
    			append(td3, t6);
    			append(tr, t7);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote, sortedTalliesByParty*/ 5 && t0_value !== (t0_value = /*vote*/ ctx[0].partyLookup[/*partyCode*/ ctx[4]].showAs + "")) set_data(t0, t0_value);
    			if (dirty & /*sortedTalliesByParty*/ 4 && t2_value !== (t2_value = /*taVotes*/ ctx[8].length + "")) set_data(t2, t2_value);
    			if (dirty & /*sortedTalliesByParty*/ 4 && t4_value !== (t4_value = /*staonVotes*/ ctx[9].length + "")) set_data(t4, t4_value);
    			if (dirty & /*sortedTalliesByParty*/ 4 && t6_value !== (t6_value = /*nilVotes*/ ctx[10].length + "")) set_data(t6, t6_value);

    			if (dirty & /*sortedTalliesByParty*/ 4) {
    				toggle_class(tr, "has-background-warning", /*breakingRanks*/ ctx[7]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    		}
    	};
    }

    // (64:6) {#if memberBreakingRanksShown}
    function create_if_block(ctx) {
    	let each_1_anchor;
    	let each_value = Object.keys(/*vote*/ ctx[0].talliesByParty);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote, Object*/ 1) {
    				each_value = Object.keys(/*vote*/ ctx[0].talliesByParty);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (66:10) {#if vote.breakingRanksPartyCodes.includes(partyCode) && partyCode !== 'Independent'}
    function create_if_block_1(ctx) {
    	let div;
    	let h4;
    	let t0_value = /*vote*/ ctx[0].partyLookup[/*partyCode*/ ctx[4]].showAs + "";
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let if_block0 = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].taVotes.length > 0 && create_if_block_4(ctx);
    	let if_block1 = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].staonVotes.length > 0 && create_if_block_3(ctx);
    	let if_block2 = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].nilVotes.length > 0 && create_if_block_2(ctx);

    	return {
    		c() {
    			div = element("div");
    			h4 = element("h4");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			if (if_block2) if_block2.c();
    			t4 = space();
    			attr(h4, "class", "title is-6");
    			attr(div, "class", "box mb-5");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h4);
    			append(h4, t0);
    			append(div, t1);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t2);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t3);
    			if (if_block2) if_block2.m(div, null);
    			append(div, t4);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote*/ 1 && t0_value !== (t0_value = /*vote*/ ctx[0].partyLookup[/*partyCode*/ ctx[4]].showAs + "")) set_data(t0, t0_value);

    			if (/*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].taVotes.length > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].staonVotes.length > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div, t3);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].nilVotes.length > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(div, t4);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    // (69:14) {#if vote.talliesByParty[partyCode].taVotes.length > 0}
    function create_if_block_4(ctx) {
    	let h5;
    	let t1;
    	let div;
    	let t2_value = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].taVotes.map(func).join(", ") + "";
    	let t2;

    	return {
    		c() {
    			h5 = element("h5");
    			h5.textContent = "Tá";
    			t1 = space();
    			div = element("div");
    			t2 = text(t2_value);
    			attr(h5, "class", "title is-6");
    			attr(div, "class", "content");
    		},
    		m(target, anchor) {
    			insert(target, h5, anchor);
    			insert(target, t1, anchor);
    			insert(target, div, anchor);
    			append(div, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote*/ 1 && t2_value !== (t2_value = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].taVotes.map(func).join(", ") + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(h5);
    			if (detaching) detach(t1);
    			if (detaching) detach(div);
    		}
    	};
    }

    // (77:14) {#if vote.talliesByParty[partyCode].staonVotes.length > 0}
    function create_if_block_3(ctx) {
    	let h5;
    	let t1;
    	let div;
    	let t2_value = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].staonVotes.map(func_1).join(", ") + "";
    	let t2;

    	return {
    		c() {
    			h5 = element("h5");
    			h5.textContent = "Staon";
    			t1 = space();
    			div = element("div");
    			t2 = text(t2_value);
    			attr(h5, "class", "title is-6");
    			attr(div, "class", "content");
    		},
    		m(target, anchor) {
    			insert(target, h5, anchor);
    			insert(target, t1, anchor);
    			insert(target, div, anchor);
    			append(div, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote*/ 1 && t2_value !== (t2_value = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].staonVotes.map(func_1).join(", ") + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(h5);
    			if (detaching) detach(t1);
    			if (detaching) detach(div);
    		}
    	};
    }

    // (85:14) {#if vote.talliesByParty[partyCode].nilVotes.length > 0}
    function create_if_block_2(ctx) {
    	let h5;
    	let t1;
    	let div;
    	let t2_value = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].nilVotes.map(func_2).join(", ") + "";
    	let t2;

    	return {
    		c() {
    			h5 = element("h5");
    			h5.textContent = "Níl";
    			t1 = space();
    			div = element("div");
    			t2 = text(t2_value);
    			attr(h5, "class", "title is-6");
    			attr(div, "class", "content");
    		},
    		m(target, anchor) {
    			insert(target, h5, anchor);
    			insert(target, t1, anchor);
    			insert(target, div, anchor);
    			append(div, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote*/ 1 && t2_value !== (t2_value = /*vote*/ ctx[0].talliesByParty[/*partyCode*/ ctx[4]].nilVotes.map(func_2).join(", ") + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(h5);
    			if (detaching) detach(t1);
    			if (detaching) detach(div);
    		}
    	};
    }

    // (65:8) {#each Object.keys(vote.talliesByParty) as partyCode}
    function create_each_block(ctx) {
    	let show_if = /*vote*/ ctx[0].breakingRanksPartyCodes.includes(/*partyCode*/ ctx[4]) && /*partyCode*/ ctx[4] !== "Independent";
    	let if_block_anchor;
    	let if_block = show_if && create_if_block_1(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*vote*/ 1) show_if = /*vote*/ ctx[0].breakingRanksPartyCodes.includes(/*partyCode*/ ctx[4]) && /*partyCode*/ ctx[4] !== "Independent";

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let main;
    	let div2;
    	let h2;
    	let t0_value = /*vote*/ ctx[0].debateTitle + "";
    	let t0;
    	let t1;
    	let h3;
    	let t2_value = /*vote*/ ctx[0].subject + "";
    	let t2;
    	let t3;
    	let p;
    	let label0;
    	let t5;
    	let t6_value = /*vote*/ ctx[0].outcome + "";
    	let t6;
    	let t7;
    	let table;
    	let thead;
    	let t15;
    	let tbody;
    	let t16;
    	let tfoot;
    	let tr1;
    	let td0;
    	let t18;
    	let td1;

    	let t19_value = (/*vote*/ ctx[0].tallies.taVotes
    	? /*vote*/ ctx[0].tallies.taVotes.tally
    	: 0) + "";

    	let t19;
    	let t20;
    	let td2;

    	let t21_value = (/*vote*/ ctx[0].tallies.staonVotes
    	? /*vote*/ ctx[0].tallies.staonVotes.tally
    	: 0) + "";

    	let t21;
    	let t22;
    	let td3;

    	let t23_value = (/*vote*/ ctx[0].tallies.nilVotes
    	? /*vote*/ ctx[0].tallies.nilVotes.tally
    	: 0) + "";

    	let t23;
    	let t24;
    	let div1;
    	let div0;
    	let label1;
    	let input;
    	let t25;
    	let t26;
    	let t27;
    	let a;
    	let t28;
    	let a_href_value;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*sortedTalliesByParty*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let if_block = /*memberBreakingRanksShown*/ ctx[1] && create_if_block(ctx);

    	return {
    		c() {
    			main = element("main");
    			div2 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			h3 = element("h3");
    			t2 = text(t2_value);
    			t3 = space();
    			p = element("p");
    			label0 = element("label");
    			label0.textContent = "Outcome:";
    			t5 = space();
    			t6 = text(t6_value);
    			t7 = space();
    			table = element("table");
    			thead = element("thead");

    			thead.innerHTML = `<tr><th class="party svelte-1fdo21a">Party</th> 
          <th>Tá</th> 
          <th>Staon</th> 
          <th>Níl</th></tr>`;

    			t15 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t16 = space();
    			tfoot = element("tfoot");
    			tr1 = element("tr");
    			td0 = element("td");
    			td0.textContent = "Total";
    			t18 = space();
    			td1 = element("td");
    			t19 = text(t19_value);
    			t20 = space();
    			td2 = element("td");
    			t21 = text(t21_value);
    			t22 = space();
    			td3 = element("td");
    			t23 = text(t23_value);
    			t24 = space();
    			div1 = element("div");
    			div0 = element("div");
    			label1 = element("label");
    			input = element("input");
    			t25 = text("\n          Show votes against party");
    			t26 = space();
    			if (if_block) if_block.c();
    			t27 = space();
    			a = element("a");
    			t28 = text("View details on oireachtas.ie");
    			attr(h2, "class", "title is-5");
    			attr(h3, "class", "subtitle is-6");
    			attr(label0, "class", "label is-inline");
    			attr(tfoot, "class", "has-text-weight-bold");
    			attr(table, "class", "table is-fullwidth");
    			attr(input, "type", "checkbox");
    			attr(label1, "class", "checkbox");
    			attr(div0, "class", "pb-4");
    			attr(a, "href", a_href_value = `https://www.oireachtas.ie/en/debates/vote/dail/${/*vote*/ ctx[0].dailTerm}/${/*vote*/ ctx[0].date}/${/*vote*/ ctx[0].id}/`);
    			attr(div2, "class", "vote svelte-1fdo21a");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div2);
    			append(div2, h2);
    			append(h2, t0);
    			append(div2, t1);
    			append(div2, h3);
    			append(h3, t2);
    			append(div2, t3);
    			append(div2, p);
    			append(p, label0);
    			append(p, t5);
    			append(p, t6);
    			append(div2, t7);
    			append(div2, table);
    			append(table, thead);
    			append(table, t15);
    			append(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			append(table, t16);
    			append(table, tfoot);
    			append(tfoot, tr1);
    			append(tr1, td0);
    			append(tr1, t18);
    			append(tr1, td1);
    			append(td1, t19);
    			append(tr1, t20);
    			append(tr1, td2);
    			append(td2, t21);
    			append(tr1, t22);
    			append(tr1, td3);
    			append(td3, t23);
    			append(div2, t24);
    			append(div2, div1);
    			append(div1, div0);
    			append(div0, label1);
    			append(label1, input);
    			input.checked = /*memberBreakingRanksShown*/ ctx[1];
    			append(label1, t25);
    			append(div1, t26);
    			if (if_block) if_block.m(div1, null);
    			append(div2, t27);
    			append(div2, a);
    			append(a, t28);

    			if (!mounted) {
    				dispose = listen(input, "change", /*input_change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*vote*/ 1 && t0_value !== (t0_value = /*vote*/ ctx[0].debateTitle + "")) set_data(t0, t0_value);
    			if (dirty & /*vote*/ 1 && t2_value !== (t2_value = /*vote*/ ctx[0].subject + "")) set_data(t2, t2_value);
    			if (dirty & /*vote*/ 1 && t6_value !== (t6_value = /*vote*/ ctx[0].outcome + "")) set_data(t6, t6_value);

    			if (dirty & /*sortedTalliesByParty, vote*/ 5) {
    				each_value_1 = /*sortedTalliesByParty*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (dirty & /*vote*/ 1 && t19_value !== (t19_value = (/*vote*/ ctx[0].tallies.taVotes
    			? /*vote*/ ctx[0].tallies.taVotes.tally
    			: 0) + "")) set_data(t19, t19_value);

    			if (dirty & /*vote*/ 1 && t21_value !== (t21_value = (/*vote*/ ctx[0].tallies.staonVotes
    			? /*vote*/ ctx[0].tallies.staonVotes.tally
    			: 0) + "")) set_data(t21, t21_value);

    			if (dirty & /*vote*/ 1 && t23_value !== (t23_value = (/*vote*/ ctx[0].tallies.nilVotes
    			? /*vote*/ ctx[0].tallies.nilVotes.tally
    			: 0) + "")) set_data(t23, t23_value);

    			if (dirty & /*memberBreakingRanksShown*/ 2) {
    				input.checked = /*memberBreakingRanksShown*/ ctx[1];
    			}

    			if (/*memberBreakingRanksShown*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*vote*/ 1 && a_href_value !== (a_href_value = `https://www.oireachtas.ie/en/debates/vote/dail/${/*vote*/ ctx[0].dailTerm}/${/*vote*/ ctx[0].date}/${/*vote*/ ctx[0].id}/`)) {
    				attr(a, "href", a_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    const func = m => m.fullName;
    const func_1 = m => m.fullName;
    const func_2 = m => m.fullName;

    function instance($$self, $$props, $$invalidate) {
    	
    	let { vote } = $$props;
    	let memberBreakingRanksShown = false;

    	function input_change_handler() {
    		memberBreakingRanksShown = this.checked;
    		$$invalidate(1, memberBreakingRanksShown);
    	}

    	$$self.$set = $$props => {
    		if ("vote" in $$props) $$invalidate(0, vote = $$props.vote);
    	};

    	let sortedTalliesByParty;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*vote*/ 1) {
    			 $$invalidate(2, sortedTalliesByParty = Object.keys(vote.talliesByParty).sort((a, b) => a.localeCompare(b)).map(partyCode => Object.assign(Object.assign({}, vote.talliesByParty[partyCode]), {
    				partyCode,
    				breakingRanks: vote.breakingRanksPartyCodes.includes(partyCode) && partyCode !== "Independent"
    			})));
    		}
    	};

    	return [vote, memberBreakingRanksShown, sortedTalliesByParty, input_change_handler];
    }

    class Vote extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { vote: 0 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.24.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (48:12) {#each termOptions as termOption}
    function create_each_block_1$1(ctx) {
    	let option;
    	let t_value = /*termOption*/ ctx[9] + "";
    	let t;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*termOption*/ ctx[9];
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (56:6) {:else}
    function create_else_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Loading...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (54:6) {#each votes as vote}
    function create_each_block$1(ctx) {
    	let vote;
    	let current;
    	vote = new Vote({ props: { vote: /*vote*/ ctx[6] } });

    	return {
    		c() {
    			create_component(vote.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(vote, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const vote_changes = {};
    			if (dirty & /*votes*/ 1) vote_changes.vote = /*vote*/ ctx[6];
    			vote.$set(vote_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(vote.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(vote.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(vote, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let main;
    	let section;
    	let div2;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let div1;
    	let label;
    	let t5;
    	let div0;
    	let select;
    	let t6;
    	let t7;
    	let footer;
    	let div3;
    	let p0;
    	let t10;
    	let p1;
    	let t11;
    	let t12_value = " " + "";
    	let t12;
    	let t13;
    	let a1;
    	let t15;
    	let t16_value = " " + "";
    	let t16;
    	let t17;
    	let a2;
    	let t19;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*termOptions*/ ctx[2];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	let each_value = /*votes*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let each1_else = null;

    	if (!each_value.length) {
    		each1_else = create_else_block();
    	}

    	return {
    		c() {
    			main = element("main");
    			section = element("section");
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Breaking Ranks";
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Which TDs have voted against their party?";
    			t3 = space();
    			div1 = element("div");
    			label = element("label");
    			label.textContent = "Dáil term:";
    			t5 = space();
    			div0 = element("div");
    			select = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t6 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each1_else) {
    				each1_else.c();
    			}

    			t7 = space();
    			footer = element("footer");
    			div3 = element("div");
    			p0 = element("p");

    			p0.innerHTML = `Source code:
          <a href="https://github.com/tewson/tds-breaking-ranks">https://github.com/tewson/tds-breaking-ranks</a>`;

    			t10 = space();
    			p1 = element("p");
    			t11 = text("Any data from the Oireachtas is licensed under the");
    			t12 = text(t12_value);
    			t13 = space();
    			a1 = element("a");
    			a1.textContent = "Oireachtas (Open Data) PSI Licence";
    			t15 = text("\n          , which incorporates the");
    			t16 = text(t16_value);
    			t17 = space();
    			a2 = element("a");
    			a2.textContent = "Creative Commons Attribution 4.0 International Licence";
    			t19 = text("\n          .");
    			attr(h1, "class", "title");
    			attr(h2, "class", "subtitle");
    			attr(label, "for", "dail-select");
    			attr(label, "class", "label is-inline-block mr-4 svelte-1r2uyzp");
    			attr(select, "id", "dail-select");
    			if (/*selectedTerm*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[4].call(select));
    			attr(div0, "class", "select");
    			attr(div1, "class", "dail-select mb-4 svelte-1r2uyzp");
    			attr(div2, "class", "container");
    			attr(a1, "href", "https://www.oireachtas.ie/en/open-data/license/");
    			attr(a2, "href", "http://creativecommons.org/licenses/by/4.0/");
    			attr(div3, "class", "content");
    			attr(footer, "class", "footer container");
    			attr(section, "class", "section");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, section);
    			append(section, div2);
    			append(div2, h1);
    			append(div2, t1);
    			append(div2, h2);
    			append(div2, t3);
    			append(div2, div1);
    			append(div1, label);
    			append(div1, t5);
    			append(div1, div0);
    			append(div0, select);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select, null);
    			}

    			select_option(select, /*selectedTerm*/ ctx[1]);
    			append(div2, t6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			if (each1_else) {
    				each1_else.m(div2, null);
    			}

    			append(section, t7);
    			append(section, footer);
    			append(footer, div3);
    			append(div3, p0);
    			append(div3, t10);
    			append(div3, p1);
    			append(p1, t11);
    			append(p1, t12);
    			append(p1, t13);
    			append(p1, a1);
    			append(p1, t15);
    			append(p1, t16);
    			append(p1, t17);
    			append(p1, a2);
    			append(p1, t19);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(select, "change", /*select_change_handler*/ ctx[4]),
    					listen(select, "change", /*init*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*termOptions*/ 4) {
    				each_value_1 = /*termOptions*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*selectedTerm, termOptions*/ 6) {
    				select_option(select, /*selectedTerm*/ ctx[1]);
    			}

    			if (dirty & /*votes*/ 1) {
    				each_value = /*votes*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();

    				if (each_value.length) {
    					if (each1_else) {
    						each1_else.d(1);
    						each1_else = null;
    					}
    				} else if (!each1_else) {
    					each1_else = create_else_block();
    					each1_else.c();
    					each1_else.m(div2, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (each1_else) each1_else.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	
    	let votes = [];
    	const termOptions = ["33", "32", "31"];
    	let selectedTerm = termOptions[0];

    	function init() {
    		return __awaiter(this, void 0, void 0, function* () {
    			$$invalidate(0, votes = []);
    			const allVotes = yield fetchVotes(selectedTerm);

    			$$invalidate(0, votes = allVotes.filter(vote => {
    				return vote.breakingRanksPartyCodes.length > 0 && !(vote.breakingRanksPartyCodes.length === 1 && vote.breakingRanksPartyCodes[0] === "Independent");
    			}));
    		});
    	}

    	init();

    	function select_change_handler() {
    		selectedTerm = select_value(this);
    		$$invalidate(1, selectedTerm);
    		$$invalidate(2, termOptions);
    	}

    	return [votes, selectedTerm, termOptions, init, select_change_handler];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    const app = new App({
        target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
