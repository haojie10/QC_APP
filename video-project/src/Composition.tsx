import React from "react";
import { 
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
  spring
} from "remotion";
import { 
  ArrowLeft, Camera, CheckCircle2, ChevronRight, 
  Layout, LogIn, ClipboardList, FileText, MousePointer2 
} from "lucide-react";

// NOTE: 系统字体
const syne = "'Segoe UI', 'Microsoft YaHei', sans-serif";
const dmSans = "'Segoe UI', 'Microsoft YaHei', sans-serif";

const LOGO = staticFile("logo.png");
const DEMO_IMAGE_1 = staticFile("demo1.png");
const DEMO_IMAGE_2 = staticFile("demo2.png");
const DEMO_IMAGE_3 = staticFile("demo3.png");
const DEMO_IMAGE_4 = staticFile("demo4.png");

const COLORS = {
  primary: "#ea5504",
  background: "#f8f9fa",
  surface: "#ffffff",
  text: "#1a1a1a",
  gray: "#6c757d",
  success: "#28a745"
};

// ================= 辅助组件 =================

const InstructionOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const y = spring({ frame, fps, config: { damping: 12 } });
  
  return (
    <div style={{
      position: "absolute",
      bottom: 80,
      left: 60,
      right: 60,
      backgroundColor: "rgba(0,0,0,0.85)",
      color: "white",
      padding: "30px 40px",
      borderRadius: 20,
      fontSize: 36,
      textAlign: "center",
      transform: `translateY(${interpolate(y, [0, 1], [200, 0])}px)`,
      zIndex: 999,
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
    }}>
      {text}
    </div>
  );
};

const Cursor: React.FC<{ startX: number, startY: number, endX: number, endY: number, moveStart: number, moveDuration: number, clickFrame?: number }> = 
({ startX, startY, endX, endY, moveStart, moveDuration, clickFrame }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [moveStart, moveStart + moveDuration], [startX, endX], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const y = interpolate(frame, [moveStart, moveStart + moveDuration], [startY, endY], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  
  let scale = 1;
  let rippleOpacity = 0;
  if (clickFrame && frame >= clickFrame && frame < clickFrame + 15) {
    scale = interpolate(frame, [clickFrame, clickFrame + 5, clickFrame + 15], [1, 0.8, 1]);
    rippleOpacity = interpolate(frame, [clickFrame, clickFrame + 15], [0.8, 0]);
  }

  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 1000, pointerEvents: "none" }}>
      {clickFrame && frame >= clickFrame && frame < clickFrame + 15 && (
        <div style={{
          position: "absolute",
          top: -15,
          left: -15,
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: COLORS.primary,
          opacity: rippleOpacity,
          transform: `scale(${interpolate(frame, [clickFrame, clickFrame+15], [0.5, 2.5])})`
        }} />
      )}
      <MousePointer2 style={{ transform: `scale(${scale})`, position: "relative", zIndex: 2 }} size={70} color="#1a1a1a" fill="white" />
    </div>
  );
};

// ================= 场景组件 =================

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1]);
  const scale = interpolate(frame, [0, 15], [0.8, 1]);

  return (
    <AbsoluteFill style={{ 
      backgroundColor: COLORS.background, 
      justifyContent: "center", 
      alignItems: "center" 
    }}>
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: "center" }}>
        <Img src={LOGO} style={{ width: 400 }} />
        <h1 style={{ 
          fontFamily: syne, 
          marginTop: 40, 
          fontSize: 80,
          color: COLORS.primary 
        }}>QC APP</h1>
        <p style={{ fontFamily: dmSans, fontSize: 32, color: COLORS.gray }}>智能移动验货助手</p>
      </div>
    </AbsoluteFill>
  );
};

const LoginScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1]);
  
  // 模拟打字效果
  const username = "qc_inspector".substring(0, Math.max(0, Math.floor((frame - 30) / 3)));
  const password = "********".substring(0, Math.max(0, Math.floor((frame - 60) / 3)));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface }}>
      <InstructionOverlay text="1. 验货员输入账号密码登录" />
      <div style={{ padding: 60, marginTop: 200, opacity }}>
        <h2 style={{ fontSize: 60, marginBottom: 40 }}>欢迎回来</h2>
        <div style={{ 
          background: "#f0f0f0", 
          padding: 30, 
          borderRadius: 20, 
          marginBottom: 30,
          display: "flex",
          alignItems: "center"
        }}>
          <LogIn size={40} color={COLORS.gray} />
          <span style={{ marginLeft: 20, fontSize: 36, color: username ? COLORS.text : COLORS.gray }}>
            {username || "用户名 / 邮箱"}
          </span>
        </div>
        <div style={{ 
          background: "#f0f0f0", 
          padding: 30, 
          borderRadius: 20, 
          marginBottom: 60,
          display: "flex",
          alignItems: "center"
        }}>
          <ClipboardList size={40} color={COLORS.gray} />
          <span style={{ marginLeft: 20, fontSize: 36, color: password ? COLORS.text : COLORS.gray }}>
            {password || "密码"}
          </span>
        </div>
        <button style={{ 
          background: frame >= 100 ? COLORS.primary : "#ccc", 
          color: "white", 
          width: "100%", 
          padding: 30, 
          borderRadius: 60, 
          fontSize: 36,
          border: "none",
          transition: "background 0.3s"
        }}>登录</button>
      </div>
      <Cursor startX={800} startY={1200} endX={540} endY={680} moveStart={90} moveDuration={20} clickFrame={110} />
    </AbsoluteFill>
  );
};

const TaskList: React.FC = () => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 20], [100, 0]);
  
  const tasks = [
    { id: "PO#2024001", name: "厨具套装验货", status: "待开始" },
    { id: "PO#2024002", name: "户外用品检测", status: "待开始" },
    { id: "PO#2024003", name: "电子配件抽检", status: "待开始" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <InstructionOverlay text="2. 选择当前需要执行的验货任务" />
      <div style={{ padding: 40, transform: `translateY(${y}px)` }}>
        <h2 style={{ fontSize: 48, marginBottom: 40 }}>验货任务列表</h2>
        {tasks.map((task, i) => (
          <div key={i} style={{ 
            background: frame >= 50 && i === 0 ? "#fff3e0" : COLORS.surface, 
            padding: 40, 
            borderRadius: 30, 
            marginBottom: 30,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 10px 20px rgba(0,0,0,0.05)"
          }}>
            <div>
              <div style={{ fontWeight: "bold", fontSize: 36 }}>{task.name}</div>
              <div style={{ fontSize: 24, color: COLORS.gray }}>{task.id}</div>
            </div>
            <div style={{ 
              background: frame >= 50 && i === 0 ? "#fff3e0" : "#f0f0f0",
              color: frame >= 50 && i === 0 ? COLORS.primary : COLORS.gray,
              padding: "10px 20px",
              borderRadius: 20,
              fontSize: 24
            }}>{frame >= 50 && i === 0 ? "进行中" : task.status}</div>
          </div>
        ))}
      </div>
      <Cursor startX={540} startY={680} endX={540} endY={260} moveStart={30} moveDuration={20} clickFrame={50} />
    </AbsoluteFill>
  );
};

const InspectionStep: React.FC<{ 
  stepNum: string, 
  title: string, 
  img: string, 
  instruction: string
}> = ({ stepNum, title, img, instruction }) => {
  const frame = useCurrentFrame();
  const captureProgress = interpolate(frame, [60, 75], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface }}>
      <InstructionOverlay text={instruction} />
      <header style={{ 
        padding: "40px", 
        borderBottom: "1px solid #eee", 
        display: "flex", 
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <ArrowLeft size={48} />
        <span style={{ fontSize: 32, fontWeight: "bold" }}>{stepNum} / 18</span>
        <div style={{ width: 48 }} />
      </header>
      
      <main style={{ padding: 40 }}>
        <h3 style={{ fontSize: 48, margin: "20px 0" }}>{title}</h3>
        <p style={{ color: COLORS.gray, fontSize: 24, marginBottom: 40 }}>请按照参考图示进行拍照，确保画面清晰。</p>
        
        <div style={{ 
          width: "100%", 
          height: 600, 
          background: "#eee", 
          borderRadius: 30, 
          overflow: "hidden",
          position: "relative"
        }}>
          {frame > 75 ? (
            <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ 
               width: "100%", 
               height: "100%", 
               display: "flex", 
               justifyContent: "center", 
               alignItems: "center",
               backgroundColor: "#f9f9f9"
            }}>
              <Camera size={120} color="#ccc" />
              <div style={{ position: "absolute", bottom: 40, color: "#999" }}>等待拍摄...</div>
            </div>
          )}
          
          {frame > 60 && frame <= 75 && (
            <AbsoluteFill style={{ 
              backgroundColor: "white", 
              opacity: interpolate(captureProgress, [0, 0.5, 1], [0, 0.8, 0]) 
            }} />
          )}
        </div>

        <div style={{ marginTop: 60, display: "flex", gap: 30 }}>
           <button style={{ 
             flex: 1, 
             background: frame >= 40 && frame < 75 ? "#c74600" : COLORS.primary, 
             color: "white", 
             padding: 30, 
             borderRadius: 60, 
             fontSize: 32,
             border: "none",
             display: "flex",
              justifyContent: "center",
              alignItems: "center"
           }}>
             <Camera size={40} style={{ marginRight: 20 }} />
             {frame > 75 ? "重新拍照" : "拍照"}
           </button>
           <button style={{ 
             width: 150, 
             background: "#f0f0f0", 
             color: COLORS.gray, 
             padding: 30, 
             borderRadius: 60, 
             fontSize: 24,
             border: "none"
           }}>跳过</button>
        </div>
      </main>
      <Cursor startX={540} startY={260} endX={400} endY={920} moveStart={20} moveDuration={20} clickFrame={40} />
    </AbsoluteFill>
  );
};

const ReportScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 60], [0, 100]);
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface, justifyContent: "center", alignItems: "center" }}>
      <InstructionOverlay text={"7. 一键生成并导出验货报告"} />
      {frame < 90 ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            width: 300, 
            height: 300, 
            borderRadius: "50%", 
            border: `20px solid #eee`, 
            borderTop: `20px solid ${COLORS.primary}`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `rotate(${frame * 10}deg)`
          }}>
             <FileText size={100} color={COLORS.primary} style={{ transform: `rotate(-${frame * 10}deg)` }} />
          </div>
          <h2 style={{ fontSize: 48, marginTop: 40 }}>正在生成验货报告...</h2>
          <div style={{ fontSize: 36, color: COLORS.primary, fontWeight: "bold" }}>{Math.floor(progress)}%</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60 }}>
          <CheckCircle2 size={240} color={COLORS.success} />
          <h2 style={{ fontSize: 60, marginTop: 40 }}>报告已生成</h2>
          <p style={{ fontSize: 32, color: COLORS.gray, marginBottom: 60 }}>您的 Excel 验货报告已准备就绪。</p>
          <button style={{ 
            background: frame >= 120 ? "#c74600" : COLORS.primary, 
            color: "white", 
            padding: "30px 80px", 
            borderRadius: 60, 
            fontSize: 36,
            border: "none"
          }}>导出并分享</button>
        </div>
      )}
      <Cursor startX={400} startY={920} endX={540} endY={1000} moveStart={100} moveDuration={20} clickFrame={120} />
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={60}>
        <Intro />
      </Sequence>
      {/* Login Screen (140 frames) */}
      <Sequence from={60} durationInFrames={140}>
        <LoginScreen />
      </Sequence>
      {/* Task List (100 frames) */}
      <Sequence from={200} durationInFrames={100}>
        <TaskList />
      </Sequence>
      
      {/* Simulation of inspection steps (120 frames each) */}
      <Sequence from={300} durationInFrames={120}>
        <InspectionStep stepNum="1" title="产品大货全景图" img={DEMO_IMAGE_1} instruction="3. 进入验货，拍摄大货全景图" />
      </Sequence>
      <Sequence from={420} durationInFrames={120}>
        <InspectionStep stepNum="4" title="外箱尺寸测量-长" img={DEMO_IMAGE_2} instruction="4. 按照引拍摄外箱尺寸照片" />
      </Sequence>
      <Sequence from={540} durationInFrames={120}>
        <InspectionStep stepNum="9" title="正唛拍照" img={DEMO_IMAGE_3} instruction="5. 拍摄产品正唛细节" />
      </Sequence>
      <Sequence from={660} durationInFrames={120}>
        <InspectionStep stepNum="15" title="产品尺寸测量-长" img={DEMO_IMAGE_4} instruction="6. 测量并拍摄产品核心尺寸" />
      </Sequence>

      <Sequence from={780} durationInFrames={160}>
        <ReportScreen />
      </Sequence>

      <Sequence from={940} durationInFrames={60}>
        <Intro />
      </Sequence>
    </AbsoluteFill>
  );
};
