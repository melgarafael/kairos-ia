"use client";

import React, { useMemo } from "react";
import { BodygraphData, BODYGRAPH_COLORS, CenterName, CENTER_TYPES } from "./types";

interface BodygraphFullSvgProps {
  data: BodygraphData;
  className?: string;
  onCenterClick?: (center: CenterName, e: React.MouseEvent) => void;
  onCenterHover?: (center: CenterName, isHovering: boolean, e: React.MouseEvent) => void;
}

export function BodygraphFullSvg({ data, className, onCenterClick, onCenterHover }: BodygraphFullSvgProps) {
  // --- Data Processing Helpers ---

  // 1. Centers
  const definedCenters = useMemo(() => {
    return new Set(data.centros_definidos.map((c) => c.toLowerCase().replace(/\s+/g, "-")));
  }, [data.centros_definidos]);

  const getCenterFill = (center: CenterName) => {
    const isDefined = definedCenters.has(center);
    if (!isDefined) return BODYGRAPH_COLORS.open.fill;
    const type = CENTER_TYPES[center];
    return BODYGRAPH_COLORS[type] || "#ccc";
  };

  const getCenterStroke = (center: CenterName) => {
    const isDefined = definedCenters.has(center);
    return isDefined ? BODYGRAPH_COLORS.defined.stroke : BODYGRAPH_COLORS.open.stroke;
  };

  const getCenterOpacity = (center: CenterName) => {
    const isDefined = definedCenters.has(center);
    return isDefined ? 1 : 0.8; // Slightly transparent for open centers if needed
  };

  // Interaction Helpers
  const centerProps = (center: CenterName) => ({
    id: `${center}-center`,
    fill: getCenterFill(center),
    stroke: getCenterStroke(center),
    strokeMiterlimit: "10",
    opacity: getCenterOpacity(center),
    onClick: (e: React.MouseEvent) => onCenterClick?.(center, e),
    onMouseEnter: (e: React.MouseEvent) => onCenterHover?.(center, true, e),
    onMouseLeave: (e: React.MouseEvent) => onCenterHover?.(center, false, e),
    style: { cursor: "pointer", transition: "fill 0.3s ease, stroke 0.3s ease" },
  });


  // 2. Gates & Lines
  // Parse Planets for P/D specifics
  const { personalityGates, designGates, activeGates } = useMemo(() => {
    const pGates = new Set<number>();
    const dGates = new Set<number>();
    const allGates = new Set<number>();

    if (data.planetas_personalidade) {
      Object.values(data.planetas_personalidade).forEach((p) => {
        if (p.Gate) {
          pGates.add(p.Gate);
          allGates.add(p.Gate);
        }
      });
    }
    if (data.planetas_design) {
      Object.values(data.planetas_design).forEach((p) => {
        if (p.Gate) {
          dGates.add(p.Gate);
          allGates.add(p.Gate);
        }
      });
    }
    // Fallback to 'portas' array if planets are missing, assuming generic activation (treat as personality for visual black, or handle mixed?)
    // The 'portas' array usually comes from the API pre-calculated.
    data.portas.forEach((g) => {
        const gateNum = parseInt(g);
        if (!isNaN(gateNum)) allGates.add(gateNum);
        // If not in planets, we might not know if P or D. 
        // However, standard API usually provides planets. 
        // If only 'portas' is present, we defaults to black (personality) for visibility? 
        // Or check typical app logic. The previous Canvas logic derived P/D from planets.
    });

    return { personalityGates: pGates, designGates: dGates, activeGates: allGates };
  }, [data]);

  // Helper to determine visibility/fill for line segments
  const getLineStyle = (gate: number, type: "personality" | "design") => {
    let isActive = false;
    if (type === "personality") {
        isActive = personalityGates.has(gate);
        // Fallback: if gate is active but not in design, assume personality if generic 'portas' used?
        if (!isActive && activeGates.has(gate) && !designGates.has(gate) && designGates.size === 0) {
             isActive = true; // Treat generic activation as personality (black)
        }
    } else {
        isActive = designGates.has(gate);
    }

    return {
      display: isActive ? "block" : "none",
      fill: type === "personality" ? BODYGRAPH_COLORS.personality : BODYGRAPH_COLORS.design,
    };
  };

  // Helper for Gate Indicators (the little ticks/shapes on centers)
  const getGateIndicatorFill = (gate: number) => {
    // If active in any way, color it dark (or active color). Reference uses #3d3b37 (Dark Grey/Black) for active.
    // If inactive, transparent or white? Reference uses transparent or not shown.
    return activeGates.has(gate) ? "#3d3b37" : "transparent"; 
  };
  
  // For gate text labels - we might want to color active ones?
  // The reference SVG uses white text for defined gates (on colored background?) or black text?
  // Actually, looking at the reference:
  // Text is <text ... fill="white"> or <text ... fill="black"> depending on context.
  // We will stick to standard visibility.

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 693"
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
    >
      {/* --- Background Group --- */}
      <g id="bg">
        {/* Head Center */}
        <path
          id="head-center"
          d="m197.71506,2.73446l-44.62799,73.18601c-1.33609,2.25299-.82085,5.10021,1.22829,6.78741.68773.54817,1.56415.82892,2.45658.78695h89.256c2.35423,0,4.40139-2.1641,4.40139-4.82005.03967-1.08493-.28315-2.15357-.92121-3.04942L204.98247,2.73446c-1.01992-1.92547-3.47094-2.6918-5.47451-1.71163-.19736.09655-.38617.20841-.5646.33448-.47159.40428-.8847.86745-1.22829,1.37716h-.00002Z"
          fill={getCenterFill("head")}
          stroke={getCenterStroke("head")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("head")}
        />
        {/* Ajna Center */}
        <path
          id="ajna-center"
          d="m197.34691,193.86404l-44.62801-73.08764c-1.33609-2.25299-.82085-5.10021,1.22829-6.78741.68773-.54817,1.56415-.82892,2.45658-.78695h89.256c2.35423,0,4.40139,2.1641,4.40139,4.82005.03967,1.08493-.28315,2.15357-.92121,3.04942l-44.62799,72.8909c-1.01992,1.92547-3.47094,2.6918-5.47451,1.71163-.19736-.09656-.38617-.20841-.5646-.33448-.44044-.44273-.81894-.93874-1.12594-1.47551Z"
          fill={getCenterFill("ajna")}
          stroke={getCenterStroke("ajna")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("ajna")}
        />
        {/* Throat Center */}
        <path
          id="throat-center"
          d="m239.04696,306.10225h-75.94948c-2.41266.01744-4.38322-1.84801-4.40139-4.16663-.00017-.02107-.00017-.04215,0-.06319v-73.08764c-.01816-2.31863,1.92296-4.21238,4.33562-4.22984.02194-.00017.04387-.00017.06577,0h75.94948c2.41266-.01746,4.38322,1.84801,4.40139,4.16663.00017.02107.00017.04215,0,.06321v73.08764c.01873,2.31809-1.92149,4.21184-4.33357,4.22982-.02263.00021-.04522.00021-.06782,0Z"
          fill={getCenterFill("throat")}
          stroke={getCenterStroke("throat")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("throat")}
        />
        {/* G Center */}
        <path
          id="g-center"
          d="m257.77587,386.27241l-53.6355,51.4466c-1.7196,1.5739-4.42186,1.5739-6.14147,0l-53.73784-51.64335c-1.63773-1.65258-1.63773-4.24952,0-5.9021l53.63548-51.54498c1.7196-1.5739,4.42186-1.5739,6.14147,0l53.73784,51.64335c1.72418,1.63589,1.74197,4.30529.03973,5.96229l-.03972.03818Z"
          fill={getCenterFill("g")}
          stroke={getCenterStroke("g")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("g")}
        />
        {/* Heart Center */}
        <path
          id="heart-center"
          d="m289.01821,393.05985l40.53369,49.67599c1.05494,1.28442.82672,3.14753-.50982,4.16138-.18983.14397-.39662.266-.61612.36357-.68131.38872-1.45955.59271-2.25188.59022h-81.06737c-2.03179.11149-3.77294-1.38099-3.88897-3.33359v-.00003l-.00062-.0109c.05368-.78144.3377-1.53205.81887-2.16411l40.43135-49.47924c1.3704-1.56762,3.74286-1.90541,5.52731-.78693.36635.30281.70849.63161,1.02358.98368v-.00003Z"
          fill={getCenterFill("heart")}
          stroke={getCenterStroke("heart")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("heart")}
        />
        {/* Sacral Center */}
        <path
          id="sacral-center"
          d="m239.14675,581.53347h-76.05185c-2.41266.01747-4.38322-1.84801-4.40139-4.16666h0c-.00017-.02095-.00017-.04203,0-.06316v-73.08763c-.01815-2.31863,1.92297-4.21238,4.33563-4.22982.02194-.00015.04386-.00015.06575,0h76.05185c2.41266-.01744,4.38322,1.84801,4.40139,4.16666h0c.00016.02101.00016.04209,0,.06316v73.18603c-.13238,2.26474-2.04231,4.05757-4.40139,4.13142Z"
          fill={getCenterFill("sacral")}
          stroke={getCenterStroke("sacral")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("sacral")}
        />
        {/* Spleen Center */}
        <path
          id="splenic-center"
          d="m93.20979,522.02065l-83.93339,45.44616c-2.56423,1.38739-5.78453.89873-7.77919-1.18043-.58911-.73314-.91262-1.63127-.92122-2.55755h0v-90.99067c0-2.36083,2.45659-4.42657,5.52732-4.42657,1.26692-.00414,2.50911.33694,3.58252.98368l83.42161,45.34776c2.45659,1.37718,3.27545,4.13148,1.53537,6.19719-.38112.49034-.87051.89344-1.43301,1.18043Z"
          fill={getCenterFill("spleen")}
          stroke={getCenterStroke("spleen")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("spleen")}
        />
        {/* Solar Plexus Center */}
        <path
          id="solar-plexus-center"
          d="m306.11195,515.33162l84.64991-45.938c2.56266-1.39573,5.78868-.9062,7.7792,1.18043.5891.73314.91262,1.63133.92121,2.55758h0v91.97432c0,2.45921-2.55894,4.42657-5.52731,4.42657-1.26692.00414-2.50912-.33694-3.58252-.98368l-84.34282-45.64291c-2.0853-.93691-2.98546-3.32101-2.01055-5.325.1525-.31346.34664-.60664.57754-.87219.37881-.57926.90794-1.05387,1.53537-1.37718l-.00003.00006Z"
          fill={getCenterFill("solar-plexus")}
          stroke={getCenterStroke("solar-plexus")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("solar-plexus")}
        />
        {/* Root Center */}
        <path
          id="root-center"
          d="m238.87612,692.54966h-75.74477c-2.35214.02131-4.27688-1.79391-4.29902-4.05439h0c-.00025-.0257-.00025-.05139,0-.07709v-73.08763c-.02216-2.26048,1.86665-4.11017,4.21879-4.13148.02675-.00024.05351-.00024.08023,0h75.84712c2.35214-.02131,4.27688,1.79391,4.29902,4.05439h0c.00025.0257.00025.05139,0,.07709v72.98928c-.05413,2.31415-1.99335,4.17777-4.40137,4.22982Z"
          fill={getCenterFill("root")}
          stroke={getCenterStroke("root")}
          strokeMiterlimit="10"
          opacity={getCenterOpacity("root")}
        />
      </g>

      {/* --- Channels & Gates Layer --- */}
      <g id="Lines">
        <g id="Group">
          {/* Background Channel Lines (Grey) */}
          <path
            id="channel-back"
            d="m217.21172,341.34452v-35.25427h8.65533l-.03888,43.41919.01655.16481-8.63301-8.32972Zm-.08704-116.78461h8.70349l.00494-65.31165-.01635-.17001-8.7248,14.19638.03271,51.28528Zm8.67871-141.04913h-8.62939l-.03009,29.65051-.00133.04782h8.66659l-.00577-.04782v-29.65051Zm-20.42529,109.27863s-.00815-.37754.00467-.36473c-.46986.7453-.91378,1.63735-1.44799,2.28091-.73329.88338-1.93493,1.42236-3.11382,1.39673-2.511-.05459-3.26759-1.83241-4.10051-3.17789l.01556.4381-.03375,31.203h8.67584v-31.77612Zm-.03625-109.27734h-8.62939l-.03009,29.65045-.00101.0466,8.66659.00697-.00609-.05357v-29.65045Zm-8.64062,245.92828l-.01913.3153s1.39434-1.44082,1.98522-1.71968c.31055-.14656,1.26447-.56901,2.1496-.56901.87285,0,1.70703.16438,2.42778.61959.72651.45885,2.13695,1.88406,2.13695,1.88406l-.00763-.53026v-23.29663l.00072-.03654h-8.6729l.00043.03654-.00104,23.29663Zm-20.56982-23.37701l.00311,43.40771,8.67584-8.33099-.02869-35.07672h-8.65027Zm101.49554,92.63232l3.86639-4.86096,2.61566-2.27307-41.05231-87.6236-.1022-.20286s-1.05633,2.24937-3.65368,2.34879c-1.78894.06848-5.06022.00629-5.06022.00629l43.38635,92.60541Zm101.94909,76.76313l8.00641-4.36094-144.16845-227.04068-.01382-.03213-.02044,16.80086,136.1963,214.63289Zm-42.57366,23.08556l7.80066-4.23773-24.92957-46.3418-.07757-.11562h-10.17228l.04965.04469,27.3291,50.65045Zm-93.53024,57.98074s61.99203-23.00735,73.71408-27.3804l.22034-.07358-11.37244-6.13925-.03882.03728-62.48499,23.23085-.03818,10.3251Zm127.90443-76.62587l-127.95164-202.92043-.03136-.0461.00384,16.82171.06298.11966,119.97955,190.33173,7.93662-4.30656Zm-127.88096,153.18651l103.44656-88.02005-8.61039-4.65344-.31618-.15354-94.69125,80.86006-.14521.14685v12.13459l.31647-.31446Zm.42278-233.5736l17.51966,19.01421,5.90668-7.17725-16.74823-18.22168-6.67811,6.38472Zm-18.11779,182.02642h-8.65851l-.0174,29.55334.00554.12094,8.69693.00891.00102-.12985-.02759-29.55334Zm-49.67633-422.25421l.01025,65.23737-.00189.03816,8.64923.00433-.00122-.04249v-51.14618l-8.65665-14.17585.00028.08466Zm20.578,451.93433h8.70349v-29.83026h-8.70349v29.83026Zm-11.91956-29.70361h-8.65948l-.01636,29.57684.00533.13492,8.70404.01384-.00587-.14876-.02765-29.57684Zm172.4881-30.83508l-114.07867,97.22937-.05566,12.59277,123.13409-104.95673-8.99976-4.86542Zm-114.10016,123.83557l.05933,12.15784,142.10217-120.79529-9.04077-4.90497-133.12073,113.54242Zm1.17302-226.68463s-2.65887-.296-3.13144-2.95811c-.34665-1.95282,1.96437-3.61675,4.95715-7.63794.01156,0-20.34119,6.48825-20.34119,6.48825v-26.91351l-8.68518,8.3652-.00781.17319.03918,21.13452-.02203.00702-11.74658,3.74554s.00101-13.78521.00009-13.77453c-.80977.64183-1.94464,2.44054-4.40369,2.41971-2.58425-.02189-3.61335-1.92618-4.30097-2.35361-.00137-.00085.00108,16.48351.00108,16.48351l-1.12762.35461-.00006.00507-10.7049,3.41345-.05933.01831v-31.66107l-.00611-.06035-8.67762-8.32012.00789.04954-.02374,42.76624-52.72406,16.76031-50.98828-44.88879,27.83282-44.17371s45.70397.48571,45.73169.47974c-2.01788-1.98419-2.97918-2.57526-2.944-4.70343.03941-2.38426,1.45814-2.97539,4.21678-5.73404l-.43642.0104-40.31305.0199,52.08423-82.66333.07727-.14047v-16.89705l-.08112.12108L30.76323,480.60446l-.08496.15546,7.93,4.31556.07574-.1197,33.63922-53.38904-4.94592,7.84998,45.76392,40.19135-53.23474,17.00073-.01867.0272,11.72657,6.36685.06957-.02937,49.94855-15.90808,36.85388,32.36627.17137.16079v-12.18886l-.11687-.11865-26.67065-23.4801,44.17841-14.09265.05823-.01788.00062,30.30642h8.70958l-.00671-33.08578.05939-.02679,11.83252-3.78809v-.00098l.02765-.00787-.02765.00885v36.98901h8.70349v-39.77533l11.66486-3.73438.12238-.03625.01049,43.46642h8.62669l-.00198-46.23216.07782-.02661,18.43767-5.91986Zm-148.18449-87.74805l.03168.02002,62.44653-98.44275.0249-16.8193-.11627.20779-69.78094,110.06628-.05743-.03552L14.45769,471.94498l7.99329,4.3172,73.70819-116.17932ZM14.87755,564.61142l143.81818,122.44641.1266.09261-.0262-12.41658-135.03876-115.104-.02993-.01842-9.00074,4.87641.15085.12357ZM184.76634,83.51206h-8.62939l-.03009,29.65045.00179.0466h8.65962l-.00193-.0466v-29.65045ZM54.01964,543.19095l104.58765,89.01233.20692.18534.03429-12.07877-96.01532-81.87872-8.81354,4.75983Zm-11.03412,5.92914l-8.74963,4.77979,124.56024,106.17853.08057-12.17529-115.89117-98.78302Zm115.78699,7.27191l-.11359-10.35791-65.43219-24.04761-11.47571,6.1413,77.02148,28.26422Z"
            fill="#dedede"
          />

          {/* Channel Segments */}
          {/* 57-20-34-10 Group */}
          <g id="_57-20-34-10-G">
            <path id="personality-10" style={getLineStyle(10, 'personality')} d="m146.03199,387.75831l-45.83935-.50183,6.36052-10.03294,40.72417.08783-2.77893,2.65209s-1.24237.92498-1.39523,2.58291c-.1499,1.62585.24215,2.1678.58807,2.77893.3507.61956,2.34076,2.43301,2.34076,2.43301Z" />
            <path id="design-10" style={getLineStyle(10, 'design')} d="m143.15546,382.23611h-39.78026l3.17795-5.01257,40.68957.08783s-2.05439,1.93075-2.98167,2.8622-1.1056,2.06255-1.1056,2.06255Z" />
            <path id="personality-34" style={getLineStyle(34, 'personality')} d="m158.71444,519.63222l-37.01665-32.53915,10.24797-3.26978,26.73999,23.53004.02869,12.27889Zm-35.31774-43.31323l-50.93893-44.99352-5.10582,8.10694,45.78647,40.18219,10.25828-3.29561Z" />
            <path id="design-34" style={getLineStyle(34, 'design')} d="m158.68575,513.47843l-31.94373-27.98038,5.20374-1.68473,26.73999,23.54001v6.1251Zm-35.30923-37.1576l-50.91875-44.99537-2.60309,4.14998,48.33384,42.519,5.18799-1.67362Z" />
            <polygon id="personality-57" style={getLineStyle(57, 'personality')} points="30.66662 480.695 92.66192 382.26507 100.23148 387.26248 69.85468 435.47544 38.65046 485.04197 34.61056 482.85409 30.66662 480.695" />
            <polygon id="design-57" style={getLineStyle(57, 'design')} points="30.67622 480.71419 92.66192 382.26507 96.48871 384.77289 34.62975 482.86369 30.67622 480.71419" />
            <polygon id="personality-20" style={getLineStyle(20, 'personality')} points="92.66192 382.26507 158.69643 277.22023 158.74099 294.55105 100.19264 387.25648 92.66192 382.26507" />
            <polygon id="design-20" style={getLineStyle(20, 'design')} points="92.66192 382.26507 158.74675 277.07968 158.71947 285.5618 96.48871 384.77289 92.66192 382.26507" />
          </g>

          {/* 10-34 G (overlaps with above, handled by same gates usually but let's include paths for robustness) */}
          {/* Note: Duplicate IDs in SVG is invalid in HTML but often ignored. We should probably rename or merge.
              The reference has multiple groups with similar IDs. We'll assume they are unique segments or alternatives.
              Since we want 100% fidelity, I will include all but check if they are visually redundant.
              Actually, looking at `_10-34-G` vs `_57-20-34-10-G`, they might render different parts of the 10-34 channel?
              Let's include them to be safe.
          */}
          <g id="_10-34-G">
             <path id="personality-34-10" style={getLineStyle(34, 'personality')} d="m158.4815,519.64844l-36.93371-32.60288,10.48886-3.25992,26.62333,23.39725-.17847,12.46555Zm-35.07103-43.32111l-50.96293-44.88665,15.02574-23.94572-7.51955-4.95661-19.4319,30.91333,52.5927,46.17357,10.29595-3.29792Z" />
             <path id="design-34-10" style={getLineStyle(34, 'design')} d="m158.65999,519.47223l-37.00945-32.54384,5.21062-1.52244,31.79996,27.94661-.00112,6.11968Zm-40.29407-41.53616l-51.92269-45.62693,17.37941-27.23384-3.86891-2.53694-19.45529,30.88994,52.61608,46.19695,5.2514-1.68918Z" />
             <path id="personality-10-34" style={getLineStyle(10, 'personality')} d="m79.95373,402.53836l15.90099-25.31546,51.44423.08438s-1.93885,1.79063-2.96974,2.85282-1.19257,2.29161-1.19257,2.29161c0,0-.23724,1.52387.2906,2.43388s2.58561,2.89762,2.58561,2.89762l-45.76201-.46768-12.77755,20.17943-7.51955-4.95661Z" />
             <path id="design-10-34" style={getLineStyle(10, 'design')} d="m83.71851,404.99365l-3.76478-2.47868,15.90099-25.29207,51.42085.08438s-4.23246,3.67125-4.18569,5.14443c-2.85282-.04677-44.97919-.11365-44.97919-.11365l-14.39217,22.65559Z" />
          </g>

          <g id="_34-57-G">
             <path id="personality-34-57" style={getLineStyle(34, 'personality')} d="m158.73319,519.66952l-37.07783-32.5658,10.29422-3.27946,26.7473,23.55313.03631,12.29213Zm-35.1533-43.08418l-50.9501-44.99072-11.91445,1.86899,52.60162,46.42992,10.26293-3.3082Z" />
             <polygon id="personality-57-34" style={getLineStyle(57, 'personality')} points="30.6555 480.72762 65.36162 425.67459 72.45777 431.32546 69.85468 435.47544 38.65033 485.06569 34.59035 482.85494 30.6555 480.72762" />
             <path id="design-34-57" style={getLineStyle(34, 'design')} d="m158.69687,513.51438l-32.01935-28.08353,5.10361-1.72828,26.93389,23.67482-.01816,6.13698Zm-35.31407-37.17314l-50.92504-45.01578-7.09615-5.65087-2.3323,3.79854,55.14358,48.49405,5.2099-1.62594Z" />
             <polygon id="design-57-34" style={getLineStyle(57, 'design')} points="30.6694 480.69981 65.36162 425.67459 68.85427 428.4285 34.59035 482.84104 30.6694 480.69981" />
          </g>

          <g id="_10-57-G">
             <polygon id="personality-57-10" style={getLineStyle(57, 'personality')} points="30.80367 480.45761 95.85144 377.31755 106.50189 377.31755 69.85468 435.47544 38.73668 484.95074 34.65246 482.74127 30.80367 480.45761" />
             <polygon id="personality-10-57" style={getLineStyle(10, 'personality')} points="145.27354 387.28064 100.1928 387.18125 100.23416 387.19435 89.61924 387.16724 95.83411 377.31755 146.85196 377.32129 144.38761 379.86678 143.24577 382.51065 143.53618 385.34377 145.27354 387.28064" />
             <polygon id="design-10-57" style={getLineStyle(10, 'design')} points="143.17306 382.28547 103.51827 382.28547 92.76636 382.27447 95.82544 377.30888 147.02386 377.30888 144.27866 380.22292 143.17306 382.28547" />
             <polygon id="design-57-10" style={getLineStyle(57, 'design')} points="30.80367 480.45761 95.79078 377.30888 101.12341 377.31262 34.65246 482.74127 30.80367 480.45761" />
          </g>

          <g id="_10-20-G">
             <polygon id="personality-10-20" style={getLineStyle(10, 'personality')} points="145.27354 387.28064 95.28908 387.17638 95.84277 377.30888 146.85196 377.32129 144.38761 379.86678 143.24577 382.51065 143.53618 385.34377 145.27354 387.28064" />
             <polygon id="design-10-20" style={getLineStyle(10, 'design')} points="145.48832 387.28064 89.69483 387.1581 92.82485 382.07049 143.02657 382.17466 143.51777 385.19412 145.48832 387.28064" />
          </g>

          <g id="_20-34-G">
             <path id="personality-34-20" style={getLineStyle(34, 'personality')} d="m60.48084,433.51012l11.94929-2.08629,50.95767,44.91598-10.25938,3.27122-45.7701-40.15032-6.87748-5.95059Zm61.11786,53.47748l37.10137,32.63518-.01537-12.25281-26.76137-23.56407-10.32463,3.1817Z" />
             <polygon id="personality-20-34" style={getLineStyle(20, 'personality')} points="60.44376 433.51012 158.70821 277.26609 158.76156 294.6045 67.37686 439.47926 60.44376 433.51012" />
             <path id="design-34-20" style={getLineStyle(34, 'design')} d="m126.89338,485.40156l31.80669,27.93339v6.28783l-37.05052-32.54603,5.24382-1.67518Zm-62.89038-48.92541l49.13809,43.1258,5.35131-1.70269-51.86727-45.5165h0l-3.59581-2.90963-2.56702,4.03699,3.5407,2.96603Z" />
             <polygon id="design-20-34" style={getLineStyle(20, 'design')} points="60.62914 433.23206 158.74675 277.07968 158.71947 285.5618 64.13495 436.35271 60.62914 433.23206" />
          </g>

          <g id="_30-41">
             <polygon id="personality-30" style={getLineStyle(30, 'personality')} points="313.03708 614.89465 376.29158 560.88842 385.38482 565.873 319.52003 621.81712 313.03708 614.89465" />
             <polygon id="design-30" style={getLineStyle(30, 'design')} points="316.25383 618.3269 380.57691 563.23254 385.38482 565.873 319.53834 621.7988 316.25383 618.3269" />
             <polygon id="personality-41" style={getLineStyle(41, 'personality')} points="243.22639 674.43152 313.2019 614.76646 319.63137 621.70944 243.28266 686.66829 243.22639 674.43152" />
             <polygon id="design-41" style={getLineStyle(41, 'design')} points="243.26302 680.2735 316.3835 618.2165 319.63137 621.70944 243.28266 686.66829 243.26302 680.2735" />
          </g>

          <g id="_55-39">
             <polygon id="personality-55" style={getLineStyle(55, 'personality')} points="299.26658 600.0931 357.28172 550.65757 366.32323 555.54032 305.70848 607.16684 299.26658 600.0931" />
             <polygon id="design-55" style={getLineStyle(55, 'design')} points="302.52187 603.6231 361.5843 553.05552 366.32323 555.54032 305.70848 607.16684 302.52187 603.6231" />
             <polygon id="personality-39" style={getLineStyle(39, 'personality')} points="243.26731 647.82365 299.37646 599.99695 305.897 607.05056 243.26731 660.44649 243.26731 647.82365" />
             <polygon id="design-39" style={getLineStyle(39, 'design')} points="243.25358 653.88096 302.61173 603.53163 305.897 607.05056 243.26731 660.40528 243.25358 653.88096" />
          </g>

          <g id="_49-19">
             <polygon id="personality-49" style={getLineStyle(49, 'personality')} points="285.14557 585.38664 338.02299 540.21188 346.96793 545.08363 291.56611 592.19682 285.14557 585.38664" />
             <polygon id="design-49" style={getLineStyle(49, 'design')} points="288.35383 588.7309 342.3617 542.57538 346.97897 592.21376 288.35383 588.7309" />
             <polygon id="personality-19" style={getLineStyle(19, 'personality')} points="243.25768 621.13545 285.41317 585.18727 291.81056 591.98997 243.29132 633.33265 243.25768 621.13545" />
             <polygon id="design-19" style={getLineStyle(19, 'design')} points="243.24085 627.04058 288.56428 588.55196 291.82049 591.98997 243.2745 633.31583 243.24085 627.04058" />
          </g>

          <g id="_18-58">
             <polygon id="personality-18" style={getLineStyle(18, 'personality')} points="14.74203 564.48981 23.79453 559.56831 89.20207 615.36234 82.75056 622.37484 14.74203 564.48981" />
             <polygon id="design-18" style={getLineStyle(18, 'design')} points="19.47482 561.94481 86.00436 618.82707 82.77606 622.40034 14.74203 564.51531 19.47482 561.94481" />
             <polygon id="personality-58" style={getLineStyle(58, 'personality')} points="82.75056 622.40034 89.12557 615.33684 158.91753 674.8719 158.8171 687.19587 82.75056 622.40034" />
             <polygon id="design-58" style={getLineStyle(58, 'design')} points="82.75056 622.37484 86.01456 618.72834 158.84226 680.99182 158.8426 687.19587 82.75056 622.37484" />
          </g>

          <g id="_28-38">
             <polygon id="personality-28" style={getLineStyle(28, 'personality')} points="34.25996 553.93389 43.03821 549.11505 103.25417 600.39893 96.86109 607.33655 34.25996 553.93389" />
             <polygon id="design-28" style={getLineStyle(28, 'design')} points="38.77134 551.50902 100.12698 603.79104 96.9111 607.35955 34.28816 553.93389 38.77134 551.50902" />
             <polygon id="personality-38" style={getLineStyle(38, 'personality')} points="96.73192 607.22666 103.16102 600.36549 158.92936 647.89804 158.8488 660.07335 96.73192 607.22666" />
             <polygon id="design-38" style={getLineStyle(38, 'design')} points="96.77816 607.17261 100.01573 603.71693 158.95276 653.90607 158.89504 660.01931 96.77816 607.17261" />
          </g>

          <g id="_32-54">
             <polygon id="personality-32" style={getLineStyle(32, 'personality')} points="54.07233 543.1859 62.88582 538.42605 117.61803 585.14987 111.21043 591.97759 54.07233 543.1859" />
             <polygon id="design-32" style={getLineStyle(32, 'design')} points="58.45378 540.72461 114.51659 588.45209 111.21043 591.97759 54.07233 543.1859 58.45378 540.72461" />
             <polygon id="personality-54" style={getLineStyle(54, 'personality')} points="111.1961 591.78877 117.53893 585.06603 158.86081 620.27494 158.84184 632.41417 111.1961 591.78877" />
             <polygon id="design-54" style={getLineStyle(54, 'design')} points="111.10209 591.84737 114.32227 588.41036 158.73833 626.24118 158.74783 632.47277 111.10209 591.84737" />
          </g>

          <g id="_9-52">
             <rect id="personality-52" style={getLineStyle(52, 'personality')} x="217.12742" y="596.16929" width="8.70349" height="15.04037" />
             <rect id="design-52" style={getLineStyle(52, 'design')} x="217.13811" y="596.16929" width="4.33793" height="15.04037" />
             <rect id="personality-9" style={getLineStyle(9, 'personality')} x="217.14482" y="581.52987" width="8.65846" height="14.76398" />
             <rect id="design-9" style={getLineStyle(9, 'design')} x="217.13811" y="581.51988" width="4.33793" height="14.77397" />
          </g>

          <g id="_3-60">
             <rect id="personality-60" style={getLineStyle(60, 'personality')} x="196.70203" y="596.07432" width="8.70346" height="15.12163" />
             <polygon id="design-60" style={getLineStyle(60, 'design')} points="196.69496 596.06638 201.0606 596.06638 201.05178 611.19177 196.70378 611.20059 196.69496 596.06638" />
             <rect id="personality-3" style={getLineStyle(3, 'personality')} x="196.70309" y="581.51988" width="8.70346" height="14.70041" />
             <polygon id="design-3" style={getLineStyle(3, 'design')} points="196.72417 581.51988 201.0621 581.51988 201.0621 596.21724 196.69496 596.22513 196.72417 581.51988" />
          </g>

          <g id="_42-53">
             <rect id="personality-53" style={getLineStyle(53, 'personality')} x="176.12425" y="596.16121" width="8.70347" height="15.05701" />
             <rect id="design-53" style={getLineStyle(53, 'design')} x="176.11574" y="596.16121" width="4.33793" height="15.05701" />
             <rect id="personality-42" style={getLineStyle(42, 'personality')} x="176.14062" y="581.51879" width="8.65948" height="14.76815" />
             <rect id="design-42" style={getLineStyle(42, 'design')} x="176.11574" y="581.51878" width="4.33793" height="14.76816" />
          </g>

          <g id="_6-59">
             <polygon id="personality-59" style={getLineStyle(59, 'personality')} points="243.53929 546.1565 278.72353 533.17494 282.18155 542.15546 243.53433 556.55527 243.53929 546.1565" />
             <polygon id="design-59" style={getLineStyle(59, 'design')} points="243.53929 551.17157 280.39577 537.50004 282.19534 542.14501 243.53929 556.5635 243.53929 551.17157" />
             <polygon id="personality-6" style={getLineStyle(6, 'personality')} points="278.50187 533.25974 306.02761 522.92068 317.39799 529.06345 282.15253 542.15783 278.50187 533.25974" />
             <polygon id="design-6" style={getLineStyle(6, 'design')} points="280.26157 537.55166 311.694 525.82909 317.39799 529.05091 282.1609 542.16579 280.26157 537.55166" />
          </g>

          <g id="_50-27">
             <polygon id="personality-50" style={getLineStyle(50, 'personality')} points="93.27941 521.98139 126.37372 534.17343 122.81717 543.20534 81.80367 528.1227 93.27941 521.98139" />
             <polygon id="design-50" style={getLineStyle(50, 'design')} points="87.60038 525.02055 124.61808 538.65799 122.84122 543.18591 81.80367 528.1227 87.60038 525.02055" />
             <polygon id="personality-27" style={getLineStyle(27, 'personality')} points="122.7175 543.17217 126.24065 534.11639 158.7116 546.02904 158.82516 556.38694 122.7175 543.17217" />
             <polygon id="design-27" style={getLineStyle(27, 'design')} points="122.7175 543.13399 124.48624 538.60607 158.66112 551.14384 158.65998 122.7175 543.13399" />
          </g>

          <g id="_46-29">
             <rect id="personality-29" style={getLineStyle(29, 'personality')} x="217.26438" y="466.54097" width="8.61648" height="33.41409" />
             <rect id="design-29" style={getLineStyle(29, 'design')} x="217.18806" y="466.54088" width="4.33793" height="33.45716" />
             <polygon id="personality-46" style={getLineStyle(46, 'personality')} points="217.19784 425.19402 225.88086 416.80452 225.88086 466.63934 217.26438 466.63934 217.19784 425.19402" />
             <polygon id="design-46" style={getLineStyle(46, 'design')} points="217.18556 425.19402 221.51796 421.05799 221.52576 466.63934 217.18783 466.63934 217.18556 425.19402" />
          </g>

          <g id="_2-14">
             <rect id="personality-14" style={getLineStyle(14, 'personality')} x="196.75494" y="466.54097" width="8.70347" height="33.54307" />
             <rect id="design-14" style={getLineStyle(14, 'design')} x="196.72417" y="466.54097" width="4.33793" height="33.54307" />
             <path id="personality-2" style={getLineStyle(2, 'personality')} d="m196.75494,436.49932s1.17146,1.23955,1.74671,1.58773,1.19591.80232,2.5432.80232,1.99859-.41869,2.57348-.78718,1.86199-1.69547,1.86199-1.69547l-.02191,30.23263h-8.70347v-30.14002Z" />
             <path id="design-2" style={getLineStyle(2, 'design')} d="m196.75494,436.49932s1.05036,1.08817,1.92837,1.72397,2.37669.66608,2.37669.66608l.0021,27.74973h-4.33793l.03077-30.13978Z" />
          </g>

          <g id="_15-5">
             <rect id="personality-5" style={getLineStyle(5, 'personality')} x="176.15953" y="466.54097" width="8.70347" height="33.41408" />
             <rect id="design-5" style={getLineStyle(5, 'design')} x="176.15101" y="466.54087" width="4.33793" height="33.41418" />
             <polygon id="personality-15" style={getLineStyle(15, 'personality')} points="176.18716 416.80452 184.863 425.13546 184.863 466.63934 176.15953 466.63934 176.18716 416.80452" />
             <polygon id="design-15" style={getLineStyle(15, 'design')} points="176.18716 416.80452 180.48894 420.8907 180.48894 466.63784 176.15101 466.63784 176.18716 416.80452" />
          </g>

          <g id="_40-37">
             <polygon id="personality-37" style={getLineStyle(37, 'personality')} points="323.8526 473.86581 331.72495 469.76781 344.85569 494.30153 337.05505 498.5393 323.8526 473.86581" />
             <polygon id="design-37" style={getLineStyle(37, 'design')} points="323.8526 473.86581 327.76577 471.82763 340.98414 496.40712 337.05505 498.5393 323.8526 473.86581" />
             <polygon id="personality-40" style={getLineStyle(40, 'personality')} points="309.72594 447.88882 319.87259 447.81574 331.72495 469.76781 323.8526 473.86581 309.72594 447.88882" />
             <polygon id="design-40" style={getLineStyle(40, 'design')} points="314.81722 447.85099 327.76577 471.82763 323.8526 473.86581 309.75732 447.87185 314.81722 447.85099" />
          </g>

          <g id="_44-26">
             <polygon id="personality-44" style={getLineStyle(44, 'personality')} points="59.87021 496.62047 163.22752 463.59279 166.29889 472.82868 71.58749 503.06314 59.87021 496.62047" />
             <polygon id="design-44" style={getLineStyle(44, 'design')} points="65.83868 499.80075 164.87601 468.17863 166.36608 472.81193 71.74181 503.06817 65.83868 499.80075" />
             <path id="personality-26" style={getLineStyle(26, 'personality')} d="m225.88086,443.71806l20.37048-6.50086-4.21536,5.12517s-.9814,1.36897-.75833,2.44914.57726,1.54289,1.2151,2.1774,2.05193.86207,2.05193.86207l-18.58604,5.91472-.07778-10.02765Zm-20.42244,16.59062l11.79217-3.74668-.04558-10.07753-11.74659,3.74555v10.07866Zm-20.64307,6.60883l11.96722-3.83134v-10.08975s-11.90974,3.83246-11.90974,3.83246l-.05749,10.08862Zm-18.46642,5.85685l9.75238-3.06726.06701-10.16086-12.93895,4.05159,3.11957,9.17653Z" />
             <path id="design-26" style={getLineStyle(26, 'design')} d="m225.91865,448.6998l15.41576-4.90931s-.43936,1.05007.44711,2.36634c1.07276,1.59288,2.73065,1.67415,2.73065,1.67415l-18.63479,5.95335.04127-5.08454Zm-20.45253,11.63061l11.7409-3.76842-.00201-5.07753-11.74718,3.74574.00828,5.10021Zm-20.5847,6.57839l11.89338-3.81198.00777-5.22906-11.87937,3.94388-.02178,5.09716Zm-18.49356,5.92491l9.73689-3.11493.02178-5.16251-11.36919,3.64544,1.61052,4.632Z" />
          </g>

          <g id="_25-51">
             <polygon id="personality-51" style={getLineStyle(51, 'personality')} points="252.28858 408.50206 259.01027 402.19374 267.39741 411.34402 261.49068 418.52125 252.28858 408.50206" />
             <polygon id="design-51" style={getLineStyle(51, 'design')} points="252.27597 408.50336 255.61477 405.35525 264.43586 414.92975 261.49952 418.51315 252.27597 408.50336" />
             <polygon id="personality-25" style={getLineStyle(25, 'personality')} points="243.96736 399.51585 250.61715 393.06375 259.1181 402.33752 252.45034 408.68178 243.96736 399.51585" />
             <polygon id="design-25" style={getLineStyle(25, 'design')} points="247.29851 396.32217 255.79727 405.55333 252.41556 408.66787 243.96031 399.51965 247.29851 396.32217" />
          </g>

          <g id="_45-21">
             <path id="personality-21" style={getLineStyle(21, 'personality')} d="m256.36262,353.18264l7.92891-4.04077,20.00701,42.54122s-1.12292.01478-2.94028,2.5709c-.44326.51714-3.67865,4.43657-3.67865,4.43657l-21.31699-45.50793Z" />
             <polygon id="design-21" style={getLineStyle(21, 'design')} points="256.36262 353.18264 260.34403 351.15362 280.88013 394.80551 277.77046 398.64789 256.36262 353.18264" />
             <path id="personality-45" style={getLineStyle(45, 'personality')} d="m234.29327,306.08519s2.24241.01331,4.84879.00304c2.82907-.01114,3.86491-2.41696,3.86491-2.41696l21.28457,45.4706-7.92891,4.04077-22.06935-47.09745Z" />
             <polygon id="design-45" style={getLineStyle(45, 'design')} points="239.26932 306.05825 260.34403 351.15362 256.36262 353.18264 234.35851 306.05468 239.26932 306.05825" />
          </g>

          <g id="_12-22">
             <polygon id="personality-22" style={getLineStyle(22, 'personality')} points="301.22846 385.14646 308.81318 380.62646 371.38107 479.79709 363.49261 484.2007 301.22846 385.14646" />
             <polygon id="design-22" style={getLineStyle(22, 'design')} points="301.22846 385.14646 305.03311 382.88106 367.44444 481.99465 363.50698 484.19168 301.22846 385.14646" />
             <polygon id="personality-12" style={getLineStyle(12, 'personality')} points="243.51303 293.86897 243.47757 276.97372 308.97695 380.8291 301.25201 385.43765 243.51303 293.86897" />
             <polygon id="design-12" style={getLineStyle(12, 'design')} points="243.4776 285.32605 305.16106 383.09354 301.25201 385.43765 243.52028 293.86439 243.4776 285.32605" />
          </g>

          <g id="_35-36">
             <polygon id="personality-36" style={getLineStyle(36, 'personality')} points="306.35354 359.87369 314.05798 355.23758 387.60196 471.07152 379.62861 475.42311 306.35354 359.87369" />
             <polygon id="design-36" style={getLineStyle(36, 'design')} points="306.35354 359.87369 310.23187 357.52466 383.65265 473.22689 379.67986 475.39057 306.35354 359.87369" />
             <polygon id="personality-35" style={getLineStyle(35, 'personality')} points="243.46666 244.05209 314.28114 355.4412 306.51457 360.12738 243.31578 260.63723 243.46666 244.05209" />
             <polygon id="design-35" style={getLineStyle(35, 'design')} points="243.4647 252.43135 310.40074 357.78436 306.46434 360.16153 243.31578 260.63723 243.4647 252.43135" />
          </g>

          <g id="_16-48">
             <polygon id="personality-48" style={getLineStyle(48, 'personality')} points="14.51036 471.93992 88.7603 355.0743 96.39312 359.79204 22.50365 476.2571 14.51036 471.93992" />
             <polygon id="design-48" style={getLineStyle(48, 'design')} points="14.54422 471.96143 88.7603 355.0743 92.59155 357.44693 18.52556 474.10853 14.54422 471.96143" />
             <polygon id="personality-16" style={getLineStyle(16, 'personality')} points="158.59865 245.04358 88.68558 355.31824 96.2435 360.09782 158.69005 261.65508 158.59865 245.04358" />
             <polygon id="design-16" style={getLineStyle(16, 'design')} points="88.68558 355.31824 158.59955 245.04414 158.59865 253.45631 92.44211 357.6919 88.68558 355.31824" />
          </g>

          <g id="_33-13">
             <polygon id="personality-13" style={getLineStyle(13, 'personality')} points="217.26438 324.53714 225.88086 324.53714 225.86334 349.72269 217.26438 341.33944 217.26438 324.53714" />
             <polygon id="design-13" style={getLineStyle(13, 'design')} points="217.25421 324.55919 221.59214 324.55919 221.58562 345.51112 217.25421 341.36149 217.25421 324.55919" />
             <rect id="personality-33" style={getLineStyle(33, 'personality')} x="217.26413" y="306.08519" width="8.65537" height="18.53244" />
             <polygon id="design-33" style={getLineStyle(33, 'design')} points="221.59214 324.59559 217.25421 324.59559 217.25421 306.13222 221.59214 306.13222 221.59214 324.59559" />
          </g>

          <g id="_8-1">
             <path id="personality-1" style={getLineStyle(1, 'personality')} d="m196.75391,317.97683h8.67278l.00342,12.01199s-1.49258-1.53674-2.12847-1.89884-1.20113-.59173-2.25212-.63589c-1.32477-.00883-1.98716.4151-2.28241.5382-.92354.60111-2.02752,1.76691-2.02752,1.76691l.01432-11.78237Z" />
             <path id="design-1" style={getLineStyle(1, 'design')} d="m196.72417,317.97684h4.33794l-.02141,9.46842s-1.45602.06074-2.27358.54703-2.02752,1.75808-2.02752,1.75808l-.01543-11.77353Z" />
             <rect id="personality-8" style={getLineStyle(8, 'personality')} x="196.75494" y="306.13863" width="8.67175" height="11.96717" />
             <polygon id="design-8" style={getLineStyle(8, 'design')} points="201.0621 318.10893 196.71144 318.11408 196.71144 306.13862 201.08585 306.1543 201.0621 318.10893" />
          </g>

          <g id="_31-7">
             <polygon id="personality-7" style={getLineStyle(7, 'personality')} points="176.20662 324.53714 184.83436 324.53714 184.863 341.13501 176.18716 349.46595 176.20662 324.53714" />
             <polygon id="design-7" style={getLineStyle(7, 'design')} points="176.15101 324.53714 180.48894 324.53714 180.48894 345.3563 176.18716 349.46595 176.15101 324.53714" />
             <rect id="personality-31" style={getLineStyle(31, 'personality')} x="176.1841" y="306.05825" width="8.65026" height="18.55912" />
             <polygon id="design-31" style={getLineStyle(31, 'design')} points="180.48894 324.61713 176.14059 324.61764 176.18716 306.13931 180.48894 306.13863 180.48894 324.61713" />
          </g>

          <g id="_11-56">
             <rect id="personality-56" style={getLineStyle(56, 'personality')} x="217.17737" y="209.02165" width="8.70349" height="15.53317" />
             <rect id="design-56" style={getLineStyle(56, 'design')} x="217.18806" y="209.02165" width="4.33793" height="15.53765" />
             <polygon id="personality-11" style={getLineStyle(11, 'personality')} points="217.14465 173.24428 225.88577 159.24321 225.88577 209.07788 217.17634 209.07786 217.14465 173.24428" />
             <polygon id="design-11" style={getLineStyle(11, 'design')} points="221.5234 209.07788 217.18547 209.07788 217.14206 173.25453 221.53513 166.0749 221.5234 209.07788" />
          </g>

          <g id="_43-23">
             <rect id="personality-23" style={getLineStyle(23, 'personality')} x="196.75494" y="209.02165" width="8.67584" height="15.53878" />
             <polygon id="design-23" style={getLineStyle(23, 'design')} points="196.74974 209.03313 201.0621 209.02165 201.0621 224.56043 196.72417 224.56043 196.74974 209.03313" />
             <path id="personality-43" style={getLineStyle(43, 'personality')} d="m200.97848,196.04788c1.328.00001,2.59644-.74568,3.14428-1.51174.78047-1.09134,1.25515-2.07336,1.32093-2.11502l.01527,16.63-8.6815-.01527s-.02135-16.16837-.01793-16.16635c.59588.95143,1.10665,1.85038,1.63104,2.33391.39752.36655,1.31091.84445,2.58791.84446Z" />
             <path id="design-43" style={getLineStyle(43, 'design')} d="m197.62034,194.27946c.33558.49965.85668,1.1868,1.73011,1.52131.70099.26847,1.69283.29084,1.69283.29084l.02387,12.95716-4.29395.01564-.01047-16.17203s.52881.89754.8576,1.38707Z" />
          </g>

          <g id="_17-62">
             <polygon id="personality-62" style={getLineStyle(62, 'personality')} points="176.18716 209.02165 184.83332 209.02165 184.82876 224.56937 176.16641 224.56317 176.18716 209.02165" />
             <polygon id="design-62" style={getLineStyle(62, 'design')} points="176.14957 209.02422 180.4875 209.02422 180.50069 224.55697 176.15401 224.55077 176.14957 209.02422" />
             <polygon id="personality-17" style={getLineStyle(17, 'personality')} points="184.81629 208.96621 176.16911 208.97986 176.16911 159.18126 184.8255 173.26347 184.81629 208.96621" />
             <polygon id="design-17" style={getLineStyle(17, 'design')} points="180.50704 166.19873 180.50704 208.97363 176.16911 208.97363 176.16911 159.17495 180.50704 166.19873" />
          </g>

          <g id="_63-4">
             <polygon id="personality-4" style={getLineStyle(4, 'personality')} points="217.19656 98.17788 225.85604 98.17788 225.84459 113.21048 217.17604 113.20118 217.19656 98.17788" />
             <polygon id="design-4" style={getLineStyle(4, 'design')} points="217.19122 98.17788 221.52915 98.17788 221.51032 113.21048 217.18535 113.21048 217.19122 98.17788" />
             <polygon id="personality-63" style={getLineStyle(63, 'personality')} points="217.19465 83.50303 225.919 83.48443 225.85309 98.45111 217.19211 98.45111 217.19465 83.50303" />
             <polygon id="design-63" style={getLineStyle(63, 'design')} points="217.20035 83.69204 221.52238 83.70983 221.52555 98.45787 217.18762 98.45787 217.20035 83.69204" />
          </g>

          <g id="_61-24">
             <rect id="personality-24" style={getLineStyle(24, 'personality')} x="196.73503" y="98.17915" width="8.65948" height="14.97831" />
             <rect id="design-24" style={getLineStyle(24, 'design')} x="196.72969" y="98.17915" width="4.33793" height="14.97831" />
             <rect id="personality-61" style={getLineStyle(61, 'personality')} x="196.76514" y="83.50696" width="8.62937" height="14.73526" />
             <polygon id="design-61" style={getLineStyle(61, 'design')} points="196.76514 83.50696 201.06445 83.49419 201.06762 98.24222 196.72969 98.24222 196.76514 83.50696" />
          </g>

          <g id="_64-47">
             <rect id="personality-47" style={getLineStyle(47, 'personality')} x="176.15953" y="98.17915" width="8.65948" height="14.97831" />
             <rect id="design-47" style={getLineStyle(47, 'design')} x="176.15419" y="98.17915" width="4.33793" height="14.97831" />
             <rect id="personality-64" style={getLineStyle(64, 'personality')} x="176.18963" y="83.50696" width="8.62937" height="14.73526" />
             <polygon id="design-64" style={getLineStyle(64, 'design')} points="176.18963 83.50696 180.48894 83.49419 180.49212 98.24222 176.15419 98.24222 176.18963 83.50696" />
          </g>
        </g>
      </g>

      {/* --- Gate Indicators (Overlay on Center Edge) --- */}
      <g id="CenterIndicators">
        {/* Root Center Gates */}
        <path id="_60" d="m200.90139,613.1665h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c.10235-3.93473,3.68487-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(60)} />
        <path id="_38" d="m169.47755,651.82523h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.93473,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(38)} />
        <path id="_41" d="m232.93938,676.0238h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.93467,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(41)} />
        <path id="_39" d="m232.63231,651.82523h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.83633,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(39)} />
        <path id="_19" d="m233.07549,627.48287h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.83633,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(19)} />
        <path id="_52" d="m221.58979,613.02388h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.83633,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(52)} />
        <path id="_53" d="m180.28709,612.90186h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.83633,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(53)} />
        <path id="_54" d="m169.36659,627.97094h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.83633,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(54)} />
        <path id="_58" d="m169.06155,676.04556h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c-.00002-3.83633,3.58251-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(58)} />

        {/* Spleen Center Gates */}
        <path id="_50" d="m78.67499,511.29855h0c4.50374,0,8.08627,3.1478,8.08627,6.98412h0c0,3.93473-3.58252,6.98412-8.08627,6.98412h0c-4.50374,0-8.08627-3.1478-8.08627-6.98412h0c.10236-3.83639,3.68488-6.98412,8.08627-6.98412Z" fill={getGateIndicatorFill(50)} />
        <path id="_32" d="m56.72026,524.17102h0c4.50374,0,8.08627,3.1478,8.08627,6.98412h0c0,3.93473-3.58252,6.98412-8.08627,6.98412h0c-4.50374,0-8.08627-3.1478-8.08627-6.98412h0c.10236-3.93473,3.58252-6.98412,8.08627-6.98412Z" fill={getGateIndicatorFill(32)} />
        <path id="_28" d="m36.76049,534.79478h0c4.50374,0,8.08627,3.1478,8.08627,6.98412h0c0,3.93473-3.58252,6.98412-8.08627,6.98412h0c-4.50374,0-8.08627-3.1478-8.08627-6.98412h0c0-3.93473,3.58252-6.98412,8.08627-6.98412Z" fill={getGateIndicatorFill(28)} />
        <path id="_18" d="m13.39425,546.9364h0c4.50374,0,8.08627,3.1478,8.08627,6.98412h0c0,3.93473-3.58252,6.98412-8.08627,6.98412h0c-4.50374,0-8.08627-3.1478-8.08627-6.98412h0c0-3.93473,3.58252-6.98412,8.08627-6.98412Z" fill={getGateIndicatorFill(18)} />
        <path id="_48" d="m11.92235,474.43896h0c4.50374,0,8.08627,3.1478,8.08627,6.98415h0c0,3.93473-3.58252,6.98415-8.08627,6.98415h0c-4.19363.20581-7.76685-2.89446-7.981-6.92466h0l-.00291-.05953h0c0-3.93473,3.58252-6.98412,7.98391-6.98412Z" fill={getGateIndicatorFill(48)} />
        <path id="_57" d="m30.05503,484.83745h0c4.50374,0,8.08627,3.1478,8.08627,6.98415h0c0,3.93473-3.58252,6.98415-8.08627,6.98415h0c-4.50374,0-8.08627-3.1478-8.08627-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(57)} />
        <path id="_44" d="m54.6209,498.41226h0c4.50374,0,8.08627,3.1478,8.08627,6.98412h0c0,3.93473-3.58252,6.98412-8.08627,6.98412h0c-4.50374,0-8.08627-3.1478-8.08627-6.98412h0c0-3.9347,3.58253-6.98412,8.08627-6.98412Z" fill={getGateIndicatorFill(44)} />

        {/* Sacral Center Gates */}
        <path id="_14" d="m200.489,501.84088h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(14)} />
        <path id="_29" d="m221.56802,501.84088h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(29)} />
        <path id="_5" d="m180.21147,501.84088h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(5)} />
        <path id="_34" d="m168.9907,516.82862h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(34)} />
        <path id="_27" d="m169.07084,548.72767h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(27)} />
        <path id="_42" d="m180.13132,565.71912h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(42)} />
        <path id="_9" d="m221.32757,565.63897h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(9)} />
        <path id="_3" d="m200.489,565.79927h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(3)} />
        <path id="_59" d="m233.34983,548.56737h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(59)} />

        {/* Solar Plexus Gates */}
        <path id="_36" d="m389.12413,475.19737h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93476,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(36)} />
        <path id="_22" d="m371.83694,484.32298h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c-.00003-3.83636,3.58249-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(22)} />
        <path id="_37" d="m345.30988,499.01431h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c.10236-3.93476,3.68489-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(37)} />
        <path id="_6" d="m319.82792,512.38057h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c.10233-3.93473,3.68486-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(6)} />
        <path id="_49" d="m346.19526,526.97647h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c.10236-3.93473,3.68489-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(49)} />
        <path id="_55" d="m365.65758,537.31991h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c0-3.83639,3.58252-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(55)} />
        <path id="_30" d="m386.35536,548.63815h0c4.50374,0,8.08626,3.1478,8.08626,6.98412h0c0,3.93473-3.58252,6.98412-8.08626,6.98412h0c-4.50374,0-8.08626-3.1478-8.08626-6.98412h0c0-3.93473,3.58252-6.98412,8.08626-6.98412Z" fill={getGateIndicatorFill(30)} />

        {/* Heart Center Gates */}
        <path id="_21" d="m285.74275,397.87989h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(21)} />
        <path id="_26" d="m258.82266,431.22673h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c-.00002-3.93473,3.58251-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(26)} />
        <path id="_51" d="m271.41266,416.07802h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c.10236-3.93473,3.68489-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(51)} />
        <path id="_40" d="m312.45814,431.22673h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(40)} />

        {/* G Center Gates */}
        <path id="_1" d="m200.85449,331.85851h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(1)} />
        <path id="_7" d="m180.33995,351.35516h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(7)} />
        <path id="_13" d="m221.60393,351.66836h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(13)} />
        <path id="_25" d="m243.76277,379.22988h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(25)} />
        <path id="_10" d="m154.65763,375.94129h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(10)} />
        <path id="_15" d="m180.57485,401.07551h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(15)} />
        <path id="_2" d="m200.93279,420.65045h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(2)} />
        <path id="_46" d="m221.36903,401.07551h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(46)} />

        {/* Throat Center Gates */}
        <path id="_8" d="m200.60786,290.33488h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(8)} />
        <path id="_33" d="m221.30059,290.0565h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(33)} />
        <path id="_31" d="m180.10072,290.0565h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(31)} />
        <path id="_20" d="m169.05842,273.35385h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(20)} />
        <path id="_16" d="m169.05842,241.24765h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(16)} />
        <path id="_62" d="m180.00793,227.32878h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(62)} />
        <path id="_23" d="m201.16462,227.32878h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(23)} />
        <path id="_56" d="m221.57897,227.42157h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(56)} />
        <path id="_35" d="m233.17803,240.87648h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(35)} />
        <path id="_12" d="m233.36361,260.4557h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(12)} />
        <path id="_45" d="m233.36361,278.55023h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(45)} />

        {/* Ajna Center Gates */}
        <path id="_24" d="m200.79345,115.60662h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(24)} />
        <path id="_47" d="m180.28631,115.60662h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(47)} />
        <path id="_4" d="m221.67176,115.7922h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(4)} />
        <path id="_17" d="m180.00793,140.5678h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(17)} />
        <path id="_43" d="m200.60786,175.1794h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(43)} />
        <path id="_11" d="m221.48617,140.75338h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(11)} />

        {/* Head Center Gates */}
        <path id="_64" d="m180.93585,67.35452h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(64)} />
        <path id="_61" d="m201.07183,67.35452h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(61)} />
        <path id="_63" d="m222.13572,67.44731h0c4.50374,0,8.08626,3.1478,8.08626,6.98415h0c0,3.93473-3.58252,6.98415-8.08626,6.98415h0c-4.50374,0-8.08626-3.1478-8.08626-6.98415h0c0-3.93473,3.58252-6.98415,8.08626-6.98415Z" fill={getGateIndicatorFill(63)} />
      </g>

      {/* --- Labels --- */}
      <g id="Labels" style={{ pointerEvents: "none", fontFamily: "Roboto, sans-serif", fontSize: "10.8px" }}>
        <text transform="translate(194.70549 623.68546) scale(1.04056 1)" fill="white">60</text>
        <text transform="translate(162.99358 662.7548) scale(1.04056 1)" fill="black">38</text>
        <text transform="translate(227.05217 686.5341) scale(1.04056 1)" fill="white">41</text>
        <text transform="translate(226.51994 662.61027) scale(1.04056 1)" fill="black">39</text>
        <text transform="translate(226.37901 638.47453) scale(1.04056 1)" fill="white">19</text>
        <text transform="translate(215.41448 623.69035) scale(1.04056 1)" fill="white">52</text>
        <text transform="translate(174.02971 623.69132) scale(1.04056 1)" fill="black">53</text>
        <text transform="translate(162.78264 638.62101) scale(1.04056 1)" fill="white">54</text>
        <text transform="translate(162.78264 686.88956) scale(1.04056 1)" fill="white">58</text>
        <text transform="translate(72.65392 522.09061) scale(1.04056 1)" fill="black">50</text>
        <text transform="translate(50.65392 534.77127) scale(1.04056 1)" fill="black">32</text>
        <text transform="translate(30.79698 545.35721) scale(1.04056 1)" fill="black">28</text>
        <text transform="translate(6.97569 557.93826) scale(1.04056 1)" fill="white">18</text>
        <text transform="translate(5.2379 485.51443) scale(1.04056 1)" fill="white">48</text>
        <text transform="translate(24.04942 496.16092) scale(1.04056 1)" fill="black">57</text>
        <text transform="translate(48.18614 509.24588) scale(1.04056 1)" fill="black">44</text>
        <text transform="translate(193.80399 512.66483) scale(1.04056 1)" fill="black">14</text>
        <text transform="translate(215.5784 512.52615) scale(1.04056 1)" fill="black">29</text>
        <text transform="translate(177.06863 512.66483) scale(1.04056 1)" fill="white">5</text>
        <text transform="translate(162.53934 527.49197) scale(1.04056 1)" fill="white">34</text>
        <text transform="translate(162.82156 559.62479) scale(1.04056 1)" fill="black">27</text>
        <text transform="translate(173.7366 576.32498) scale(1.04056 1)" fill="black">42</text>
        <text transform="translate(218.17606 576.64041) scale(1.04056 1)" fill="black">9</text>
        <text transform="translate(197.46512 576.56717) scale(1.04056 1)" fill="black">3</text>
        <text transform="translate(227.19071 559.60818) scale(1.04056 1)" fill="black">59</text>
        <text transform="translate(383.08751 486.22928) scale(1.04056 1)" fill="black">36</text>
        <text transform="translate(365.66563 495.20779) scale(1.04056 1)" fill="black">22</text>
        <text transform="translate(339.12071 509.80643) scale(1.04056 1)" fill="black">37</text>
        <text transform="translate(316.81114 523.17654) scale(1.04056 1)" fill="white">6</text>
        <text transform="translate(339.92052 537.70975) scale(1.04056 1)" fill="black">49</text>
        <text transform="translate(359.41075 548.31815) scale(1.04056 1)" fill="black">55</text>
        <text transform="translate(380.19786 559.54471) scale(1.04056 1)" fill="black">30</text>
        <text transform="translate(279.94884 408.46658) scale(1.04056 1)" fill="black">21</text>
        <text transform="translate(252.69395 441.8533) scale(1.04056 1)" fill="black">26</text>
        <text transform="translate(265.61485 426.8992) scale(1.04056 1)" fill="white">51</text>
        <text transform="translate(306.14806 441.8533) scale(1.04056 1)" fill="black">40</text>
        <text transform="translate(197.34793 343.01248) scale(1.04056 1)" fill="black">1</text>
        <text transform="translate(177.35086 362.5994) scale(1.04056 1)" fill="black">7</text>
        <text transform="translate(214.58426 362.52615) scale(1.04056 1)" fill="white">13</text>
        <text transform="translate(237.47391 389.93924) scale(1.04056 1)" fill="white">25</text>
        <text transform="translate(147.99246 386.80643) scale(1.04056 1)" fill="black">10</text>
        <text transform="translate(173.60867 412.03006) scale(1.04056 1)" fill="black">15</text>
        <text transform="translate(198.01785 431.491) scale(1.04056 1)" fill="black">2</text>
        <text transform="translate(215.03348 411.94217) scale(1.04056 1)" fill="white">46</text>
        <text transform="translate(197.56242 301.1575) scale(1.04056 1)" fill="black">8</text>
        <text transform="translate(215.17179 300.97244) scale(1.04056 1)" fill="white">33</text>
        <text transform="translate(173.96476 301.10672) scale(1.04056 1)" fill="black">31</text>
        <text transform="translate(163.24015 284.0159) scale(1.04056 1)" fill="black">20</text>
        <text transform="translate(162.35538 252.44168) scale(1.04056 1)" fill="black">16</text>
        <text transform="translate(173.25675 238.25076) scale(1.04056 1)" fill="black">62</text>
        <text transform="translate(195.16691 238.30106) scale(1.04056 1)" fill="black">23</text>
        <text transform="translate(215.3671 238.25076) scale(1.04056 1)" fill="black">56</text>
        <text transform="translate(227.06632 251.6033) scale(1.04056 1)" fill="black">35</text>
        <text transform="translate(226.40324 271.10233) scale(1.04056 1)" fill="black">12</text>
        <text transform="translate(226.83488 289.63358) scale(1.04056 1)" fill="black">45</text>
        <text transform="translate(194.83887 126.16287) scale(1.04056 1)" fill="black">24</text>
        <text transform="translate(173.96484 126.13309) scale(1.04056 1)" fill="black">47</text>
        <text transform="translate(218.19727 126.22733) scale(1.04056 1)" fill="black">4</text>
        <text transform="translate(173.21973 151.89041) scale(1.04056 1)" fill="white">17</text>
        <text transform="translate(194.3252 185.7659) scale(1.04056 1)" fill="black">43</text>
        <text transform="translate(215.56641 151.83768) scale(1.04056 1)" fill="black">11</text>
        <text transform="translate(174.69298 78.10867) scale(1.04056 1)" fill="black">64</text>
        <text transform="translate(194.89122 78.17215) scale(1.04056 1)" fill="white">61</text>
        <text transform="translate(215.85411 78.17215) scale(1.04056 1)" fill="black">63</text>
      </g>
    </svg>
  );
}

