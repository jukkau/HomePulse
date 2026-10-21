import { execFileSync } from "node:child_process";

function runGit(args, options = {}) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    }).trim();
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    const stdout = error.stdout ? String(error.stdout).trim() : "";
    const message = stderr || stdout || error.message;
    throw new Error(message);
  }
}

function printStatusLine(label, value) {
  console.log(`${label}: ${value}`);
}

let hasProblem = false;

function warn(message) {
  hasProblem = true;
  console.log(`- ${message}`);
}

const branch = runGit(["branch", "--show-current"]) || "detached HEAD";
printStatusLine("当前分支", branch);

let upstream = "";
try {
  upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  printStatusLine("远端跟踪", upstream);
} catch (_) {
  warn("当前分支没有设置远端跟踪分支，无法判断是否和远端同步。可用 git push -u origin <branch> 设置。");
}

if (upstream) {
  try {
    runGit(["fetch", "--quiet"]);
  } catch (error) {
    warn(`拉取远端状态失败：${error.message}`);
  }

  try {
    const [aheadText, behindText] = runGit(["rev-list", "--left-right", "--count", `HEAD...${upstream}`]).split(/\s+/);
    const ahead = Number(aheadText || 0);
    const behind = Number(behindText || 0);

    printStatusLine("本地未推送提交", `${ahead}`);
    printStatusLine("远端未拉取提交", `${behind}`);

    if (behind > 0 && ahead > 0) {
      warn(`本地和远端已分叉：本地 ahead ${ahead}，远端 behind ${behind}。请先处理同步冲突，不要直接 push。`);
    } else if (behind > 0) {
      warn(`这台电脑落后远端 ${behind} 个提交。建议先运行 git pull --ff-only。`);
    } else if (ahead > 0) {
      warn(`这台电脑有 ${ahead} 个提交还没推送。建议运行 git push。`);
    }
  } catch (error) {
    warn(`比较本地和远端提交失败：${error.message}`);
  }
}

const status = runGit(["status", "--porcelain"]);
if (status) {
  const lines = status.split("\n");
  warn(`工作区有 ${lines.length} 个未提交变更。请先 commit、stash 或确认这些是本地临时文件。`);
  for (const line of lines.slice(0, 20)) {
    console.log(`  ${line}`);
  }
  if (lines.length > 20) {
    console.log(`  ... 还有 ${lines.length - 20} 项`);
  }
} else {
  printStatusLine("工作区", "干净");
}

if (hasProblem) {
  console.log("\n同步检查未通过：建议处理以上问题后再开始写代码。");
  process.exitCode = 1;
} else {
  console.log("\n同步检查通过：本地代码干净，并且已和远端同步。");
}
