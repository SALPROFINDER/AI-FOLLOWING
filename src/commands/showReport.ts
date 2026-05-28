import { getLatestRunSummary } from '../db';
import { logger } from '../logger';
import fs from 'fs';
import path from 'path';
import { SocialMetricResult } from '../types';

export function generateReport(): string {
  const summary = getLatestRunSummary();
  if (!summary) {
    throw new Error('No runs found in the database. Run the benchmark first.');
  }

  const { run, results } = summary;
  const reportPath = path.join(process.cwd(), 'reports', 'provider-comparison.md');

  // Group results by provider
  const providerStats: Record<string, {
    total: number;
    success: number;
    skipped: number;
    rateLimited: number;
    notFound: number;
    private: number;
    error: number;
    unsupported: number;
    durationSum: number;
    durations: number[];
  }> = {};

  for (const res of results) {
    if (!providerStats[res.provider]) {
      providerStats[res.provider] = {
        total: 0,
        success: 0,
        skipped: 0,
        rateLimited: 0,
        notFound: 0,
        private: 0,
        error: 0,
        unsupported: 0,
        durationSum: 0,
        durations: [],
      };
    }

    const stats = providerStats[res.provider];
    stats.total++;
    stats.durationSum += res.durationMs;
    stats.durations.push(res.durationMs);

    switch (res.status) {
      case 'success': stats.success++; break;
      case 'skipped': stats.skipped++; break;
      case 'rate_limited': stats.rateLimited++; break;
      case 'not_found': stats.notFound++; break;
      case 'private': stats.private++; break;
      case 'error': stats.error++; break;
      case 'unsupported': stats.unsupported++; break;
    }
  }

  // Group results by username to compute differences
  const usernameGroups: Record<string, Record<string, SocialMetricResult>> = {};
  for (const res of results) {
    if (!usernameGroups[res.username]) {
      usernameGroups[res.username] = {};
    }
    usernameGroups[res.username][res.provider] = res;
  }

  // Compute metric differences
  const valueDifferences: {
    username: string;
    metric: string;
    values: { provider: string; val: number }[];
  }[] = [];

  for (const [username, providers] of Object.entries(usernameGroups)) {
    const successfulProviders = Object.entries(providers).filter(([_, r]) => r.status === 'success');
    if (successfulProviders.length > 1) {
      const followers: { provider: string; val: number }[] = [];
      const followings: { provider: string; val: number }[] = [];
      const posts: { provider: string; val: number }[] = [];

      for (const [pName, res] of successfulProviders) {
        if (res.followersCount !== null) followers.push({ provider: pName, val: res.followersCount });
        if (res.followingCount !== null) followings.push({ provider: pName, val: res.followingCount });
        if (res.postsCount !== null) posts.push({ provider: pName, val: res.postsCount });
      }

      const checkDiff = (metricName: string, list: { provider: string; val: number }[]) => {
        if (list.length > 1) {
          const firstVal = list[0].val;
          const hasDiff = list.some(item => item.val !== firstVal);
          if (hasDiff) {
            valueDifferences.push({ username, metric: metricName, values: list });
          }
        }
      };

      checkDiff('followersCount', followers);
      checkDiff('followingCount', followings);
      checkDiff('postsCount', posts);
    }
  }

  // Automatic Recommendations
  const providersList = Object.keys(providerStats);
  
  let bestFreeProvider = 'None';
  let bestOfficialProvider = 'None';
  let bestExperimentalProvider = 'None';
  let mostReliableProvider = 'None';
  let fastestProvider = 'None';

  let highestSuccessRate = -1;
  let lowestSuccessfulDuration = Infinity;

  // Best free: instaloader or digitalmethods_batch
  const freeProviders = ['instaloader', 'digitalmethods_batch'];
  let bestFreeSuccess = 0;
  for (const name of freeProviders) {
    const stats = providerStats[name];
    if (stats && stats.success > bestFreeSuccess) {
      bestFreeSuccess = stats.success;
      bestFreeProvider = name;
    }
  }
  if (bestFreeProvider === 'None' && providerStats['instaloader']) {
    bestFreeProvider = 'instaloader (skipped/no successful fetch yet)';
  }

  // Best official: meta_graph
  const metaStats = providerStats['meta_graph'];
  if (metaStats && metaStats.success > 0) {
    bestOfficialProvider = 'meta_graph';
  } else if (metaStats) {
    bestOfficialProvider = 'meta_graph (configured but 0 successful fetches)';
  }

  // Best experimental
  const expProviders = ['instagrapi_experimental', 'dilame_private_api_experimental'];
  let bestExpSuccess = 0;
  for (const name of expProviders) {
    const stats = providerStats[name];
    if (stats && stats.success > bestExpSuccess) {
      bestExpSuccess = stats.success;
      bestExperimentalProvider = name;
    }
  }

  // Most reliable & fastest (excluding 'mock')
  for (const [name, stats] of Object.entries(providerStats)) {
    if (name === 'mock') continue;
    
    const successRate = stats.total > 0 ? stats.success / stats.total : 0;
    if (successRate > highestSuccessRate && stats.success > 0) {
      highestSuccessRate = successRate;
      mostReliableProvider = name;
    }

    const avgDuration = stats.success > 0 ? stats.durationSum / stats.total : Infinity;
    if (avgDuration < lowestSuccessfulDuration && stats.success > 0) {
      lowestSuccessfulDuration = avgDuration;
      fastestProvider = name;
    }
  }

  // If no other provider worked, mock is default
  if (mostReliableProvider === 'None') {
    mostReliableProvider = 'mock';
  }
  if (fastestProvider === 'None') {
    fastestProvider = 'mock';
  }

  // Build the markdown report
  let md = `# Instagram Social Metrics Provider Comparison Report\n\n`;
  md += `**Run ID:** \`${run.runId}\`  \n`;
  md += `**Date:** ${new Date(run.startedAt).toLocaleString('fr-FR')}  \n`;
  md += `**Usernames Tested:** ${run.usernameCount}  \n`;
  md += `**Providers Tested:** ${run.providerCount}\n\n`;

  md += `## Provider Statistics\n\n`;
  md += `| Provider | Success Rate | Avg Duration | Success | Skipped | Rate Limited | Not Found | Private | Errors | Unsupported |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const [name, stats] of Object.entries(providerStats)) {
    const successRate = stats.total > 0 ? `${Math.round((stats.success / stats.total) * 100)}%` : '0%';
    const avgDuration = stats.total > 0 ? `${Math.round(stats.durationSum / stats.total)}ms` : '-';
    
    md += `| **${name}** | ${successRate} | ${avgDuration} | ${stats.success} | ${stats.skipped} | ${stats.rateLimited} | ${stats.notFound} | ${stats.private} | ${stats.error} | ${stats.unsupported} |\n`;
  }
  
  md += `\n*Note: "Success Rate" includes all results. Rates are computed based on target profiles.*`;
  
  md += `\n\n## Value Differences Between Providers\n\n`;
  if (valueDifferences.length === 0) {
    md += `✅ **No differences detected!** All successful providers reported identical values for followers, following, and posts counts.\n`;
  } else {
    md += `⚠️ **Detected differences between providers:**\n\n`;
    md += `| Username | Metric | Provider Values |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const diff of valueDifferences) {
      const valsStr = diff.values.map(v => `${v.provider}: ${v.val.toLocaleString()}`).join(', ');
      md += `| ${diff.username} | \`${diff.metric}\` | ${valsStr} |\n`;
    }
  }

  md += `\n## Automatic Recommendation\n\n`;
  md += `- 🏆 **Best Free Provider:** \`${bestFreeProvider}\`\n`;
  md += `- 🏢 **Best Official Provider:** \`${bestOfficialProvider}\`\n`;
  md += `- 🧪 **Best Experimental Provider:** \`${bestExperimentalProvider}\`\n`;
  md += `- 🎯 **Most Reliable (excl. mock):** \`${mostReliableProvider}\` (Success rate: ${highestSuccessRate > 0 ? Math.round(highestSuccessRate * 100) + '%' : 'N/A'})\n`;
  md += `- ⚡ **Fastest (excl. mock):** \`${fastestProvider}\` (${lowestSuccessfulDuration !== Infinity ? Math.round(lowestSuccessfulDuration) + 'ms avg' : 'N/A'})\n\n`;

  md += `## Compliance & Defense Notes\n\n`;
  md += `> [!IMPORTANT]\n`;
  md += `> Ce projet est conçu dans un but d'évaluation et de benchmark défensif à l'école 42. Les règles suivantes sont scrupuleusement suivies :\n`;
  md += `> - **Pas de bypass CAPTCHA ni de rotation de proxy** pour ne pas masquer de comportement suspect.\n`;
  md += `> - **Pas d'utilisation de sessions ou cookies persistants** pour les requêtes gratuites (Instaloader).\n`;
  md += `> - **Aucune récupération agressive** (limitation à un appel séquentiel toutes les 5 secondes).\n`;
  md += `> - **Pas de vol de cookies** ni d'extraction de données privées.\n`;

  // Write report
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(reportPath, md, 'utf-8');
  logger.success(`Markdown report saved to: ${reportPath}`);

  return md;
}

// If executed directly
if (require.main === module) {
  try {
    const report = generateReport();
    console.log('\nGenerated Report Summary:');
    console.log(report);
  } catch (err: any) {
    logger.error(err.message);
    process.exit(1);
  }
}
