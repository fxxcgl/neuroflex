import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  CameraOff, ArrowLeft, Activity, RefreshCw, Play, Pause, Award,
  CheckCircle2, AlertTriangle, RotateCcw, Zap, ChevronRight,
  ShieldCheck, Volume2, VolumeX, Timer, ChevronDown, Info, Eye,
} from 'lucide-react';
import type { ExerciseType } from '../types';
import { recordCompletedSession, fetchPatientDashboardStats } from '../lib/sessionService';
import type { CompletedRepData } from '../lib/sessionService';
import { getInjuryConfig, getPrescribedExercises } from '../lib/injuryConfig';
import { getExerciseConfig, isSelfReportedExercise, isAngleRepExercise } from '../lib/exerciseConfig';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { speechCoach } from '../lib/speechCoach';
import type { MovementAnalysisResult } from '../api/analyzeMovement';
import { x402Fetch, getX402WalletAddress } from '../lib/x402Client';
import { WalletConnectPrompt } from '../components/modals/WalletConnectPrompt';
import { PaymentMethodSelector, type PaymentMethod } from '../components/modals/PaymentMethodSelector';
import { SESSION_FEE_DISPLAY } from '../lib/wagmiConfig';
import { createAnkleCircleTracker, createBalanceHoldTracker, createGaitTracker } from '../lib/trajectoryTracker';

function calculateAngle(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number}):number{
  const r=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(a.y-b.y,a.x-b.x);
  let d=Math.abs((r*180)/Math.PI);if(d>180)d=360-d;return Math.round(d);
}

export type RepPhase='REST'|'ECCENTRIC'|'PEAK_CONTRACTION'|'CONCENTRIC';

export interface RepLog{
  repNumber:number;peakAngle?:number|null;minAngle?:number|null;romRange?:number|null;
  targetMet:boolean;timestamp:string;holdDurationSeconds?:number|null;
  stabilityScore?:number|null;rotationCount?:number|null;selfReported?:boolean;
}

function getExerciseEmoji(type:ExerciseType):string{
  const m:Partial<Record<ExerciseType,string>>={knee_extension:'🦵',shoulder_raise:'🦾',straight_leg_raise:'🏋️',heel_slides:'🦶',mini_squats:'🏃',sit_to_stand:'🪑',calf_raises:'⬆️',ankle_pumps:'🔄',ankle_circles:'⭕',balance_hold:'⚖️',gait_training:'🚶',quad_sets:'💪',resistance_band:'🎗️',muscle_activation:'⚡'};
  return m[type]??'🏥';
}

interface ExercisePickerProps{exercises:ExerciseType[];selected:ExerciseType;onSelect:(ex:ExerciseType)=>void}
const ExercisePicker:React.FC<ExercisePickerProps>=({exercises,selected,onSelect})=>{
  const[open,setOpen]=useState(false);const cfg=getExerciseConfig(selected);
  return(<div className="relative">
    <button type="button" id="exercise-picker-btn" onClick={()=>setOpen(!open)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-50 border-2 border-teal-400 text-teal-900 font-black text-sm shadow-sm hover:bg-teal-100 transition-colors" aria-haspopup="listbox" aria-expanded={open}>
      <span className="text-lg">{getExerciseEmoji(selected)}</span><span>{cfg.label}</span><ChevronDown className="w-4 h-4 ml-1"/>
    </button>
    {open&&(<div className="absolute top-full mt-2 left-0 z-50 w-64 bg-white rounded-2xl border-2 border-slate-200 shadow-xl overflow-hidden" role="listbox">
      {exercises.map(ex=>{const c=getExerciseConfig(ex);const mode=c.trackingMode;const ml=mode==='angle_rep'?'Camera':mode==='trajectory'?'Trajectory':'Self-Report';const mb=mode==='angle_rep'?'bg-teal-100 text-teal-800':mode==='trajectory'?'bg-blue-100 text-blue-800':'bg-amber-100 text-amber-800';
        return(<button key={ex} type="button" role="option" aria-selected={ex===selected} onClick={()=>{onSelect(ex);setOpen(false);}} className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${ex===selected?'bg-teal-50':''}`}>
          <span className="text-xl">{getExerciseEmoji(ex)}</span>
          <div className="flex-1 min-w-0"><span className="block font-bold text-slate-900 text-sm">{c.label}</span><span className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded-full mt-0.5 ${mb}`}>{ml}</span></div>
          {ex===selected&&<CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0"/>}
        </button>);})}
    </div>)}
  </div>);
};

const SelfReportNote:React.FC=()=>(<div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-xs text-amber-900 font-semibold" role="note">
  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/><span>Camera guidance only — completion is self-reported and cannot be independently verified by pose tracking.</span>
</div>);

interface TimerHoldPanelProps{holdDuration:number;onSetComplete:(sec:number)=>void;isMuted:boolean}
const TimerHoldPanel:React.FC<TimerHoldPanelProps>=({holdDuration,onSetComplete,isMuted})=>{
  const[active,setActive]=useState(false);const[elapsed,setElapsed]=useState(0);const intRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const start=()=>{setActive(true);setElapsed(0);intRef.current=setInterval(()=>{setElapsed(p=>{const n=p+1;if(holdDuration>0&&n>=holdDuration){clearInterval(intRef.current!);setActive(false);if(!isMuted)speechCoach.speak('Release — great hold!','high');return n;}if(holdDuration>0&&holdDuration-n<=5&&!isMuted)speechCoach.speak(`${holdDuration-n}`,'high');return n;});},1000);};
  const stop=()=>{if(intRef.current)clearInterval(intRef.current!);setActive(false);};
  useEffect(()=>()=>{if(intRef.current)clearInterval(intRef.current);},[]);
  const pct=holdDuration>0?Math.min(100,(elapsed/holdDuration)*100):0;const rem=Math.max(0,holdDuration-elapsed);
  return(<div className="space-y-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
    <div className="flex items-center gap-2 text-amber-900 font-black"><Timer className="w-5 h-5 text-amber-600"/><span>{holdDuration>0?`Hold Timer (${holdDuration}s)`:'Guided Hold'}</span></div>
    {holdDuration>0&&(<><div className="text-center text-5xl font-black text-amber-700 tabular-nums">{active?rem:elapsed>0?'✓':holdDuration}<span className="text-lg font-bold text-amber-500">s</span></div>
    <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-1000" style={{width:`${pct}%`}}/></div></>)}
    <div className="flex gap-2">
      {!active?(<button type="button" id="hold-start-btn" onClick={start} className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black flex items-center justify-center gap-2"><Play className="w-4 h-4"/>{elapsed>0?'Restart Hold':'Start Hold'}</button>
      ):(<button type="button" id="hold-stop-btn" onClick={stop} className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black flex items-center justify-center gap-2"><Pause className="w-4 h-4"/>Stop</button>)}
      <button type="button" id="hold-confirm-btn" onClick={()=>{stop();onSetComplete(elapsed);setElapsed(0);}} disabled={holdDuration>0&&elapsed<holdDuration*0.5} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/>I Completed This Set</button>
    </div>
  </div>);
};
export const ExerciseSessionPage:React.FC=()=>{
  const navigate=useNavigate();const{profile,user}=useAuth();
  const[searchParams]=useSearchParams();const{t,i18n}=useTranslation();
  const videoRef=useRef<HTMLVideoElement|null>(null);const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const animFrameId=useRef<number|null>(null);const poseLandmarkerRef=useRef<PoseLandmarker|null>(null);
  const[prescribedExercises,setPrescribedExercises]=useState<ExerciseType[]>(['knee_extension']);
  const[exerciseType,setExerciseType]=useState<ExerciseType>('knee_extension');
  const[cameraActive,setCameraActive]=useState(false);const[cameraError,setCameraError]=useState<string|null>(null);
  const[modelLoading,setModelLoading]=useState(true);const[modelLoaded,setModelLoaded]=useState(false);
  const[isPaused,setIsPaused]=useState(false);const[isSavingSession,setIsSavingSession]=useState(false);
  const[movementAnalysis,setMovementAnalysis]=useState<MovementAnalysisResult|null>(null);
  const[isWalletPromptOpen,setIsWalletPromptOpen]=useState(false);const[isMethodSelectorOpen,setIsMethodSelectorOpen]=useState(false);
  const[showPaymentToast,setShowPaymentToast]=useState(false);const[prescriptionId,setPrescriptionId]=useState<string|null>(null);
  const[isUsingDefaultTargets,setIsUsingDefaultTargets]=useState(false);
  const[clinicalLabel,setClinicalLabel]=useState('Exercise Session');const[focalJoint,setFocalJoint]=useState('Joint');
  const[isVoiceGuidanceMuted,setIsVoiceGuidanceMuted]=useState(()=>localStorage.getItem('speechCoachMuted')==='true');
  const hasSpokenInitialRef=useRef(false);
  useEffect(()=>{speechCoach.setLanguage(i18n.language);},[i18n.language]);
  useEffect(()=>{speechCoach.setMuted(isVoiceGuidanceMuted);localStorage.setItem('speechCoachMuted',String(isVoiceGuidanceMuted));},[isVoiceGuidanceMuted]);

  useEffect(()=>{
    let m=true;const uid=user?.id||profile?.id;if(!uid)return;
    fetchPatientDashboardStats(uid).then(stats=>{if(!m)return;
      const cfg=getInjuryConfig(stats.primaryInjury);const exs=getPrescribedExercises(stats.primaryInjury);
      setPrescribedExercises(exs);setExerciseType(cfg.exerciseType);setClinicalLabel(cfg.clinicalLabel);setFocalJoint(cfg.focalJoint);
      if(stats.prescription&&stats.prescription.id!=='rx-default'){setPrescriptionId(stats.prescription.id);setIsUsingDefaultTargets(false);}
      else setIsUsingDefaultTargets(true);});
    return()=>{m=false;};
  },[user,profile]);

  const[trackingConfidence,setTrackingConfidence]=useState(0);const[detectedLandmarksCount,setDetectedLandmarksCount]=useState(0);
  const[currentAngle,setCurrentAngle]=useState(0);const[fps,setFps]=useState(0);
  const[trackingStatus,setTrackingStatus]=useState<'searching'|'tracking'|'poor_visibility'>('searching');
  const[formFeedback,setFormFeedback]=useState<{message:string;type:'good'|'warning'|'info'}>({message:'Get in position to start',type:'info'});
  const[repPhaseState,setRepPhaseState]=useState<RepPhase>('REST');const[repCount,setRepCount]=useState(0);
  const repLogsRef=useRef<RepLog[]>([]);const[repLogs,setRepLogs]=useState<RepLog[]>([]);
  const currentRepPeakAngle=useRef(0);const currentRepMinAngle=useRef(999);
  const repPhaseRef=useRef<RepPhase>('REST');const peakHoldFramesRef=useRef(0);const reachedPeakRef=useRef(false);
  const[trajectoryCount,setTrajectoryCount]=useState(0);const[stabilityScore,setStabilityScore]=useState<number|null>(null);
  const[holdSeconds,setHoldSeconds]=useState(0);const[gaitCadence,setGaitCadence]=useState<number|null>(null);
  const[trajectoryAsymmetryFlag,setTrajectoryAsymmetryFlag]=useState(false);
  const ankleCircleTrackerRef=useRef(createAnkleCircleTracker());
  const balanceHoldTrackerRef=useRef(createBalanceHoldTracker());
  const gaitTrackerRef=useRef(createGaitTracker());
  const[isSummaryOpen,setIsSummaryOpen]=useState(false);const[sessionStartTime]=useState(Date.now());
  const lastFrameTime=useRef(performance.now());const frameCount=useRef(0);const lastVideoTime=useRef(-1);
  const activeSideRef=useRef<'left'|'right'|null>(null);const smoothedAngleRef=useRef<number>(0);

  const getThresholdsForExercise=useCallback((ex:ExerciseType)=>{
    const cfg=getExerciseConfig(ex);if(!cfg.angleRep)return{rest:90,peak:165,target:160,tolerance:10,peakIsHigher:true};
    return{rest:cfg.angleRep.restAngle,peak:cfg.angleRep.peakAngle,target:cfg.angleRep.targetAngle,tolerance:cfg.angleRep.tolerance,peakIsHigher:cfg.angleRep.peakIsHigher};
  },[]);
  const thresholdsRef=useRef(getThresholdsForExercise('knee_extension'));

  const handleExerciseChange=useCallback((ex:ExerciseType)=>{
    setExerciseType(ex);const cfg=getExerciseConfig(ex);setClinicalLabel(cfg.clinicalLabel);setFocalJoint(cfg.focalJoint);
    thresholdsRef.current=getThresholdsForExercise(ex);
    repPhaseRef.current='REST';setRepPhaseState('REST');setRepCount(0);repLogsRef.current=[];setRepLogs([]);
    currentRepPeakAngle.current=0;currentRepMinAngle.current=999;peakHoldFramesRef.current=0;reachedPeakRef.current=false;
    activeSideRef.current=null;smoothedAngleRef.current=0;
    setTrajectoryCount(0);setStabilityScore(null);setHoldSeconds(0);setGaitCadence(null);
    ankleCircleTrackerRef.current.reset();balanceHoldTrackerRef.current.reset();gaitTrackerRef.current.reset();
    setFormFeedback({message:`Switched to ${cfg.label}. Get in position.`,type:'info'});
    if(!isVoiceGuidanceMuted)speechCoach.speak(`Starting ${cfg.label}`,'normal');
  },[getThresholdsForExercise,isVoiceGuidanceMuted]);

  useEffect(()=>{let m=true;
    async function init(){try{setModelLoading(true);
      const v=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      if(!m)return;
      const lm=await PoseLandmarker.createFromOptions(v,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:0.5,minPosePresenceConfidence:0.5,minTrackingConfidence:0.5});
      if(!m)return;poseLandmarkerRef.current=lm;setModelLoaded(true);setModelLoading(false);
    }catch(e:any){if(m){setModelLoading(false);setCameraError('Failed to load pose tracking model.');}}}
    init();return()=>{m=false;poseLandmarkerRef.current?.close();};
  },[]);

  const startCamera=useCallback(async()=>{setCameraError(null);try{
    const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
    if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.onloadedmetadata=()=>{videoRef.current?.play();setCameraActive(true);};}
  }catch(e:any){setCameraActive(false);if(e.name==='NotAllowedError')setCameraError('Camera permission denied.');else if(e.name==='NotFoundError')setCameraError('No camera found.');else setCameraError(e.message||'Camera unavailable.');}
  },[]);

  const stopCamera=useCallback(()=>{if(videoRef.current?.srcObject){(videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());videoRef.current.srcObject=null;}setCameraActive(false);},[]);
  useEffect(()=>{if(modelLoaded)startCamera();return()=>stopCamera();},[modelLoaded,startCamera,stopCamera]);
  useEffect(()=>{if(modelLoaded&&cameraActive&&!hasSpokenInitialRef.current){hasSpokenInitialRef.current=true;speechCoach.speak(`Ready for ${getExerciseConfig(exerciseType).label}. Get into position.`,'normal');}},[modelLoaded,cameraActive,exerciseType]);
  const processAngleRep=(landmarks:NormalizedLandmark[],ctx:CanvasRenderingContext2D,canvas:HTMLCanvasElement)=>{
    const cfg=getExerciseConfig(exerciseType);const arCfg=cfg.angleRep;if(!arCfg)return;
    const th=thresholdsRef.current;
    const lLms=arCfg.landmarks.left.map(i=>landmarks[i]);const rLms=arCfg.landmarks.right.map(i=>landmarks[i]);
    const lVis=Math.min(...lLms.map(l=>l?.visibility??0));const rVis=Math.min(...rLms.map(l=>l?.visibility??0));
    if(!activeSideRef.current){activeSideRef.current=lVis>=rVis?'left':'right';}
    else if(activeSideRef.current==='left'&&rVis>lVis+0.15&&rVis>0.45){activeSideRef.current='right';}
    else if(activeSideRef.current==='right'&&lVis>rVis+0.15&&lVis>0.45){activeSideRef.current='left';}
    const useLeft=activeSideRef.current==='left';const usedLms=useLeft?lLms:rLms;const sideName=useLeft?'Left':'Right';
    if(!usedLms[0]||!usedLms[1]||!usedLms[2]||Math.min(lVis,rVis)<0.15)return;
    const[la,lb,lc]=usedLms;
    const rawA=calculateAngle({x:la.x*canvas.width,y:la.y*canvas.height},{x:lb.x*canvas.width,y:lb.y*canvas.height},{x:lc.x*canvas.width,y:lc.y*canvas.height});
    const mA=smoothedAngleRef.current===0?rawA:Math.round(smoothedAngleRef.current*0.55+rawA*0.45);
    smoothedAngleRef.current=mA;
    setCurrentAngle(mA);
    const colors:Record<string,string>={knee_extension:'#f59e0b',shoulder_raise:'#0284c7',straight_leg_raise:'#a855f7',heel_slides:'#10b981',mini_squats:'#f97316',sit_to_stand:'#6366f1',calf_raises:'#ec4899',ankle_pumps:'#06b6d4'};
    const color=colors[exerciseType]??'#38bdf8';
    ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=6;ctx.moveTo(la.x*canvas.width,la.y*canvas.height);ctx.lineTo(lb.x*canvas.width,lb.y*canvas.height);ctx.lineTo(lc.x*canvas.width,lc.y*canvas.height);ctx.stroke();
    ctx.beginPath();ctx.arc(lb.x*canvas.width,lb.y*canvas.height,10,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    const label=`${sideName} ${cfg.focalJoint}: ${mA}°`;ctx.font='bold 18px "Plus Jakarta Sans",sans-serif';
    const tw=ctx.measureText(label).width;const bx=Math.max(10,Math.min(canvas.width-tw-30,lb.x*canvas.width+15));const by=Math.max(30,lb.y*canvas.height-10);
    ctx.fillStyle='rgba(15,23,42,0.9)';ctx.beginPath();ctx.roundRect(bx-8,by-22,tw+16,32,8);ctx.fill();ctx.strokeStyle='#38bdf8';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(label,bx,by);
    if(exerciseType==='mini_squats'){const oLms=lVis>=rVis?rLms:lLms;if(oLms[0]&&oLms[1]&&oLms[2]){const oA=calculateAngle({x:oLms[0].x*canvas.width,y:oLms[0].y*canvas.height},{x:oLms[1].x*canvas.width,y:oLms[1].y*canvas.height},{x:oLms[2].x*canvas.width,y:oLms[2].y*canvas.height});if(Math.abs(mA-oA)>15){setFormFeedback({message:`Knee asymmetry (${Math.abs(mA-oA)}°). Try to squat evenly.`,type:'warning'});speechCoach.speak('Keep your knees even','normal');}}}
    const{peakIsHigher}=th;const restExit=peakIsHigher?th.rest+th.tolerance:th.rest-th.tolerance;const peakEnter=peakIsHigher?th.peak-th.tolerance:th.peak+th.tolerance;
    const inRest=peakIsHigher?mA<=restExit:mA>=restExit;const inPeak=peakIsHigher?mA>=peakEnter:mA<=peakEnter;
    if(mA>currentRepPeakAngle.current)currentRepPeakAngle.current=mA;if(mA<currentRepMinAngle.current)currentRepMinAngle.current=mA;
    const cp=repPhaseRef.current;
    if(cp==='REST'){if(!inRest){repPhaseRef.current='ECCENTRIC';setRepPhaseState('ECCENTRIC');currentRepMinAngle.current=mA;currentRepPeakAngle.current=mA;reachedPeakRef.current=false;setFormFeedback({message:'Moving... keep a smooth tempo',type:'info'});}}
    else if(cp==='ECCENTRIC'){if(inPeak){reachedPeakRef.current=true;repPhaseRef.current='PEAK_CONTRACTION';setRepPhaseState('PEAK_CONTRACTION');peakHoldFramesRef.current=0;
      const sot=peakIsHigher?mA<th.target-th.tolerance:mA>th.target+th.tolerance;
      if(sot){const msg=t('speech.extend_further','Try to reach a little further');speechCoach.speak(msg,'high');setFormFeedback({message:msg,type:'warning'});}else setFormFeedback({message:'Target reached! Hold briefly.',type:'good'});
    }else if(inRest&&!reachedPeakRef.current){repPhaseRef.current='REST';setRepPhaseState('REST');}}
    else if(cp==='PEAK_CONTRACTION'){peakHoldFramesRef.current+=1;if(inRest||peakHoldFramesRef.current>=6){repPhaseRef.current='CONCENTRIC';setRepPhaseState('CONCENTRIC');}}
    else if(cp==='CONCENTRIC'){if(inRest){
      const peak=peakIsHigher?currentRepPeakAngle.current:currentRepMinAngle.current;const other=peakIsHigher?currentRepMinAngle.current:currentRepPeakAngle.current;
      const rom=Math.abs(peak-other);const tm=peakIsHigher?peak>=th.target-th.tolerance:peak<=th.target+th.tolerance;
      if(reachedPeakRef.current&&rom>=15){const n=repLogsRef.current.length+1;
        const log:RepLog={repNumber:n,peakAngle:Math.round(peak),minAngle:Math.round(Math.min(peak,other)),romRange:Math.round(rom),targetMet:tm,timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),selfReported:false};
        repLogsRef.current.push(log);setRepLogs([...repLogsRef.current]);setRepCount(n);speechCoach.speak(t('speech.rep_complete','Repetition complete'),'normal');
        if(tm){setFormFeedback({message:`Rep ${n} complete! Target met 🎉`,type:'good'});speechCoach.speak(['Great form','Nice work','Perfect'][Math.floor(Math.random()*3)],'normal');}
        else setFormFeedback({message:`Rep ${n} logged. Try for more range!`,type:'warning'});}
      repPhaseRef.current='REST';setRepPhaseState('REST');currentRepPeakAngle.current=0;currentRepMinAngle.current=999;reachedPeakRef.current=false;}}
  };

  const processTrajectory=(landmarks:NormalizedLandmark[],nowMs:number)=>{
    if(exerciseType==='ankle_circles'){
      const lF=landmarks[31],lA=landmarks[27],rF=landmarks[32],rA=landmarks[28];
      const lV=Math.min(lF?.visibility??0,lA?.visibility??0),rV=Math.min(rF?.visibility??0,rA?.visibility??0);
      const[foot,ankle]=lV>=rV?[lF,lA]:[rF,rA];const snap=ankleCircleTrackerRef.current.update(foot,ankle);
      setTrajectoryCount(snap.count);if(snap.cue)setFormFeedback({message:snap.cue,type:snap.eventThisFrame?'good':'info'});
      if(snap.eventThisFrame){const log:RepLog={repNumber:snap.count,targetMet:true,timestamp:new Date().toLocaleTimeString(),rotationCount:snap.count,selfReported:false};repLogsRef.current=[log];setRepLogs([...repLogsRef.current]);speechCoach.speak(`Circle ${snap.count} complete`,'normal');}
    }else if(exerciseType==='balance_hold'){
      const snap=balanceHoldTrackerRef.current.update(landmarks,nowMs);
      setTrajectoryCount(snap.count);setStabilityScore(snap.score);setHoldSeconds(snap.holdSeconds);
      if(snap.cue)setFormFeedback({message:snap.cue,type:snap.eventThisFrame?'good':snap.score!=null&&snap.score<60?'warning':'info'});
      if(snap.eventThisFrame){const log:RepLog={repNumber:snap.count,targetMet:true,timestamp:new Date().toLocaleTimeString(),holdDurationSeconds:getExerciseConfig('balance_hold').trajectory?.targetHoldSeconds,stabilityScore:snap.score,selfReported:false};repLogsRef.current.push(log);setRepLogs([...repLogsRef.current]);speechCoach.speak(`Hold ${snap.count} complete. Great balance.`,'high');}
    }else if(exerciseType==='gait_training'){
      const snap=gaitTrackerRef.current.update(landmarks,nowMs);setTrajectoryCount(snap.count);setGaitCadence(snap.cadence);setTrajectoryAsymmetryFlag(snap.asymmetryFlag);
      if(snap.cue)setFormFeedback({message:snap.cue,type:snap.asymmetryFlag?'warning':'info'});
      if(snap.eventThisFrame){const log:RepLog={repNumber:snap.count,targetMet:!snap.asymmetryFlag,timestamp:new Date().toLocaleTimeString(),selfReported:false};repLogsRef.current=[log];setRepLogs([...repLogsRef.current]);}
    }
  };
  const renderLoop=useCallback(()=>{
    const video=videoRef.current,canvas=canvasRef.current,lm=poseLandmarkerRef.current;
    if(!video||!canvas||!lm||!cameraActive||isPaused){animFrameId.current=requestAnimationFrame(renderLoop);return;}
    if(video.readyState>=2&&video.videoWidth>0){
      if(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight){canvas.width=video.videoWidth;canvas.height=video.videoHeight;}
      const ctx=canvas.getContext('2d');if(ctx){ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);
        const now=performance.now();
        if(now-lastVideoTime.current>=16){lastVideoTime.current=now;const results:PoseLandmarkerResult=lm.detectForVideo(video,now);
          frameCount.current+=1;if(now-lastFrameTime.current>=1000){setFps(Math.round((frameCount.current*1000)/(now-lastFrameTime.current)));frameCount.current=0;lastFrameTime.current=now;}
          if(results.landmarks?.length>0){const lms=results.landmarks[0];setDetectedLandmarksCount(lms.length);
            const vLms=lms.filter(l=>(l.visibility??1)>0.65);const ac=Math.round((vLms.reduce((a,l)=>a+(l.visibility??1),0)/lms.length)*100);
            setTrackingConfidence(ac);setTrackingStatus(ac>60?'tracking':'poor_visibility');
            const du=new DrawingUtils(ctx);du.drawConnectors(lms,PoseLandmarker.POSE_CONNECTIONS,{color:'#2dd4bf',lineWidth:4});du.drawLandmarks(lms,{color:'#ffffff',fillColor:'#0d9488',radius:5,lineWidth:2});
            const mode=getExerciseConfig(exerciseType).trackingMode;
            if(mode==='angle_rep')processAngleRep(lms,ctx,canvas);
            else if(mode==='trajectory')processTrajectory(lms,now);
          }else{setTrackingStatus('searching');setTrackingConfidence(0);}
        }ctx.restore();}
    }animFrameId.current=requestAnimationFrame(renderLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cameraActive,isPaused,exerciseType]);

  useEffect(()=>{if(cameraActive&&!isPaused)animFrameId.current=requestAnimationFrame(renderLoop);return()=>{if(animFrameId.current)cancelAnimationFrame(animFrameId.current);};},[cameraActive,isPaused,renderLoop]);

  const handleSelfReportSetComplete=(sec:number)=>{
    const n=repLogsRef.current.length+1;
    const log:RepLog={repNumber:n,targetMet:true,timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),holdDurationSeconds:sec,selfReported:true};
    repLogsRef.current.push(log);setRepLogs([...repLogsRef.current]);setRepCount(n);
    setFormFeedback({message:`Set ${n} confirmed! ✓`,type:'good'});speechCoach.speak(`Set ${n} complete`,'normal');
  };

  const prepareSessionPayload=()=>{
    const si=new Date(sessionStartTime).toISOString(),ei=new Date().toISOString();
    const pid=user?.id||profile?.id||(isSupabaseConfigured?'':'p-001');
    const reps:CompletedRepData[]=repLogsRef.current.map(r=>({repNumber:r.repNumber,peakAngle:r.peakAngle??undefined,minAngle:r.minAngle??undefined,romRange:r.romRange??undefined,targetMet:r.targetMet,compensationFlags:r.targetMet?['Target Met']:['Partial Range'],holdDurationSeconds:r.holdDurationSeconds??undefined,stabilityScore:r.stabilityScore??undefined,rotationCount:r.rotationCount??undefined,selfReported:r.selfReported??false}));
    return{patientId:pid,exerciseType,targetAngle:getExerciseConfig(exerciseType).angleRep?.targetAngle??0,startedAt:si,endedAt:ei,reps};
  };

  const handleFinishSession=()=>{
    const mode=getExerciseConfig(exerciseType).trackingMode;const c=repLogsRef.current.length;
    speechCoach.speak(`Session complete. ${c} ${mode==='angle_rep'?'reps':mode==='trajectory'?'sets':'holds'}. Nice work.`,'high');
    stopCamera();setIsPaused(true);setIsMethodSelectorOpen(true);
  };

  const executeAnalysisCall=async(method:'web3'|'upi',pid?:string)=>{setIsSavingSession(true);const pl=prepareSessionPayload();
    try{const res=await x402Fetch('/api/rehab/analyze-movement',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pl)});const d=await res.json();
      if(res.ok&&d.success&&d.analysis){setMovementAnalysis(d.analysis);if(method==='web3'){setShowPaymentToast(true);setTimeout(()=>setShowPaymentToast(false),3000);}
        await recordCompletedSession({patientId:pl.patientId,prescriptionId:prescriptionId||null,exerciseType:pl.exerciseType,startedAt:pl.startedAt,endedAt:pl.endedAt,reps:pl.reps});
        setIsSavingSession(false);setIsSummaryOpen(true);}
      else{alert('Unexpected response.');setIsSavingSession(false);}
    }catch(e){console.error(e);alert('Failed to connect to analysis endpoint.');setIsSavingSession(false);}
  };

  const processPaymentAndAnalysis=async(method:PaymentMethod)=>{setIsMethodSelectorOpen(false);
    if(method==='web3'){if(!getX402WalletAddress()){setIsWalletPromptOpen(true);return;}await executeAnalysisCall('web3');}
    else if(method==='upi'){const opts={key:'rzp_test_123',amount:16000,currency:'INR',name:'NeuroFlex AI',description:'Session Analysis Fee',handler:async(r:any)=>{await executeAnalysisCall('upi',r.razorpay_payment_id);},prefill:{name:profile?.full_name||'Patient',email:user?.email||'patient@example.com',contact:'9999999999'},theme:{color:'#0f172a'},modal:{ondismiss:()=>setIsSavingSession(false)}};
      if((window as any).Razorpay){setIsSavingSession(true);new(window as any).Razorpay(opts).open();}else alert('Payment gateway failed.');}
  };

  const handlePayLater=async()=>{setIsMethodSelectorOpen(false);setIsSavingSession(true);const pl=prepareSessionPayload();
    try{await recordCompletedSession({patientId:pl.patientId,prescriptionId:prescriptionId||null,exerciseType:pl.exerciseType,startedAt:pl.startedAt,endedAt:pl.endedAt,reps:pl.reps});}catch{}
    finally{setIsSavingSession(false);navigate('/patient/dashboard?session_recorded=true');}
  };

  const getPhaseBadge=(p:RepPhase)=>{switch(p){case'REST':return{label:'Resting',color:'bg-slate-100 text-slate-800 border-slate-300'};case'ECCENTRIC':return{label:'Moving to Peak',color:'bg-sky-100 text-sky-900 border-sky-300 animate-pulse'};case'PEAK_CONTRACTION':return{label:'Peak Contraction',color:'bg-amber-100 text-amber-950 border-amber-400 font-black'};case'CONCENTRIC':return{label:'Returning',color:'bg-teal-100 text-teal-900 border-teal-300'};}};

  const exCfg=getExerciseConfig(exerciseType);const trackingMode=exCfg.trackingMode;
  const totalLogs=repLogs.length;const avgPeak=totalLogs>0&&trackingMode==='angle_rep'?Math.round(repLogs.reduce((a,r)=>a+(r.peakAngle??0),0)/totalLogs):0;
  const targetMetCount=repLogs.filter(r=>r.targetMet).length;const th=thresholdsRef.current;
  const dur=Math.max(1,Math.round((Date.now()-sessionStartTime)/1000));const sm=Math.floor(dur/60);const ss=dur%60;
  return(<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border-2 border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <Link to="/patient/dashboard" className="touch-target px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center gap-2 transition-colors" aria-label="Back to dashboard"><ArrowLeft className="w-5 h-5"/><span className="hidden sm:inline">Back</span></Link>
        <div><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"/><h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">AI Vision Rehab Tracking</h1></div><p className="text-xs text-slate-500 font-medium">On-Device MediaPipe • Multi-Mode Exercise Analysis</p></div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {prescribedExercises.length>1&&<ExercisePicker exercises={prescribedExercises} selected={exerciseType} onSelect={handleExerciseChange}/>}
        {prescribedExercises.length===1&&<span className="text-sm font-black text-teal-900 bg-teal-50 px-4 py-2.5 rounded-2xl border-2 border-teal-500">{clinicalLabel}</span>}
        <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${trackingMode==='angle_rep'?'bg-teal-50 border-teal-300 text-teal-800':trackingMode==='trajectory'?'bg-blue-50 border-blue-300 text-blue-800':'bg-amber-50 border-amber-300 text-amber-800'}`}>{trackingMode==='angle_rep'?'📐 Angle Rep':trackingMode==='trajectory'?'🔄 Trajectory':'⏱ Timer Hold'}</span>
        <button onClick={handleFinishSession} disabled={isSavingSession} type="button" id="finish-session-btn" className="touch-target px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm shadow-md transition-all flex items-center gap-2">
          {isSavingSession?<><Activity className="w-4 h-4 text-teal-400 animate-spin"/>Saving...</>:<><CheckCircle2 className="w-4 h-4 text-teal-400"/>Finish Session</>}
        </button>
      </div>
    </div>

    {trackingMode==='timer_hold'&&<SelfReportNote/>}

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 bg-slate-950 rounded-3xl overflow-hidden border-4 border-slate-900 shadow-2xl relative aspect-video flex items-center justify-center">
        {modelLoading&&(<div className="absolute inset-0 z-30 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white space-y-3"><Activity className="w-12 h-12 text-teal-400 animate-spin"/><h2 className="text-2xl font-bold">Initializing On-Device AI...</h2><p className="text-slate-400 text-sm max-w-md">Loading MediaPipe pose model.</p></div>)}
        {cameraError&&(<div className="absolute inset-0 z-30 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-4"><div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30"><CameraOff className="w-8 h-8"/></div><h2 className="text-xl font-bold text-red-200">Camera Issue</h2><p className="text-slate-300 text-sm max-w-md">{cameraError}</p><button onClick={startCamera} type="button" className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Retry</button></div>)}
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" aria-label="Live camera feed"/>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"/>
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700 text-white text-xs font-bold shadow-lg">
          <span className={`w-2.5 h-2.5 rounded-full ${trackingStatus==='tracking'?'bg-emerald-400 animate-pulse':trackingStatus==='poor_visibility'?'bg-amber-400':'bg-red-400'}`}/>
          <span>{trackingStatus==='tracking'?'Pose Tracking Active':trackingStatus==='poor_visibility'?'Partial Visibility':'Locating Person...'}</span>
          <span className="text-slate-400">|</span><span className="text-teal-300">{fps} FPS</span>
        </div>
        <div className="absolute top-4 right-4 z-20">
          {trackingMode==='angle_rep'&&<div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xl backdrop-blur-md ${getPhaseBadge(repPhaseState).color}`}>{getPhaseBadge(repPhaseState).label}</div>}
          {trackingMode==='trajectory'&&<div className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xl backdrop-blur-md bg-blue-100 text-blue-900 border-blue-300">Trajectory Tracking</div>}
          {trackingMode==='timer_hold'&&<div className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-xl backdrop-blur-md bg-amber-100 text-amber-900 border-amber-300">Self-Report Mode</div>}
        </div>
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3">
          {trackingMode==='angle_rep'&&(<>
            <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-teal-400 text-white shadow-2xl flex flex-col"><span className="text-xs font-black text-teal-300 uppercase tracking-wide">Live {focalJoint} Angle</span><span className="text-4xl sm:text-5xl font-black text-white leading-none mt-1">{currentAngle>0?`${currentAngle}°`:'—'}</span><span className="text-[11px] font-bold text-slate-400 mt-1">Target: {th.target}° (±{th.tolerance}°)</span>{isUsingDefaultTargets&&<span className="text-[10px] text-amber-300 mt-1">Using default targets</span>}</div>
            <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-amber-400 text-white shadow-2xl flex flex-col"><span className="text-xs font-black text-amber-300 uppercase tracking-wide">Reps</span><span className="text-4xl sm:text-5xl font-black text-amber-400 leading-none mt-1">{repCount}</span><span className="text-[11px] font-bold text-slate-400 mt-1">{targetMetCount} Met Target</span></div>
          </>)}
          {trackingMode==='trajectory'&&(<>
            <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-blue-400 text-white shadow-2xl flex flex-col"><span className="text-xs font-black text-blue-300 uppercase tracking-wide">{exerciseType==='ankle_circles'?'Rotations':exerciseType==='balance_hold'?'Holds':'Steps'}</span><span className="text-4xl sm:text-5xl font-black text-blue-400 leading-none mt-1">{trajectoryCount}</span>{exerciseType==='balance_hold'&&stabilityScore!=null&&<span className="text-[11px] font-bold text-slate-400 mt-1">Stability: {stabilityScore}%</span>}{exerciseType==='gait_training'&&gaitCadence!=null&&<span className="text-[11px] font-bold text-slate-400 mt-1">{gaitCadence} steps/min</span>}</div>
            {exerciseType==='balance_hold'&&<div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-teal-400 text-white shadow-2xl flex flex-col"><span className="text-xs font-black text-teal-300 uppercase tracking-wide">Hold Time</span><span className="text-4xl sm:text-5xl font-black text-teal-300 leading-none mt-1">{Math.round(holdSeconds)}s</span></div>}
            {exerciseType==='gait_training'&&trajectoryAsymmetryFlag&&<div className="bg-amber-500/20 backdrop-blur-md px-4 py-3 rounded-2xl border-2 border-amber-400 text-amber-200 shadow-2xl flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400"/><span className="text-xs font-black">Asymmetry<br/>Detected</span></div>}
          </>)}
          {trackingMode==='timer_hold'&&<div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-amber-400 text-white shadow-2xl flex flex-col"><span className="text-xs font-black text-amber-300 uppercase tracking-wide">Sets Logged</span><span className="text-4xl sm:text-5xl font-black text-amber-400 leading-none mt-1">{repCount}</span><span className="text-[11px] font-bold text-amber-300/70 mt-1 flex items-center gap-1"><Eye className="w-3 h-3"/>Self-Reported</span></div>}
        </div>
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button onClick={()=>setIsVoiceGuidanceMuted(!isVoiceGuidanceMuted)} type="button" aria-label={isVoiceGuidanceMuted?'Unmute':'Mute'} id="voice-toggle-btn" className="touch-target px-4 py-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md border border-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg">{isVoiceGuidanceMuted?<VolumeX className="w-4 h-4 text-slate-400"/>:<Volume2 className="w-4 h-4 text-emerald-400"/>}<span className="hidden sm:inline">{isVoiceGuidanceMuted?'Muted':'Voice On'}</span></button>
          <button onClick={()=>setIsPaused(!isPaused)} type="button" aria-label={isPaused?'Resume':'Pause'} id="pause-resume-btn" className="touch-target px-4 py-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md border border-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg">{isPaused?<Play className="w-4 h-4 text-emerald-400"/>:<Pause className="w-4 h-4 text-amber-400"/>}<span>{isPaused?'Resume':'Pause'}</span></button>
        </div>
      </div>

      <div className="lg:col-span-4 space-y-5">
        <div className={`p-5 rounded-3xl border-2 shadow-md space-y-2 transition-all ${formFeedback.type==='good'?'bg-emerald-50 border-emerald-300 text-emerald-950':formFeedback.type==='warning'?'bg-amber-50 border-amber-300 text-amber-950':'bg-sky-50 border-sky-300 text-sky-950'}`}>
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">{formFeedback.type==='good'&&<CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/>}{formFeedback.type==='warning'&&<AlertTriangle className="w-5 h-5 text-amber-600 shrink-0"/>}{formFeedback.type==='info'&&<Zap className="w-5 h-5 text-sky-600 shrink-0"/>}<span>Live Guidance</span></div>
          <p className="text-base font-extrabold leading-snug">{formFeedback.message}</p>
        </div>
        {trackingMode==='angle_rep'&&(<div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-md space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><Activity className="w-5 h-5 text-teal-600"/>Rep Cycle Phase</h2><span className="text-xs font-bold text-slate-500">Phase {repPhaseState==='REST'?'1':repPhaseState==='ECCENTRIC'?'2':repPhaseState==='PEAK_CONTRACTION'?'3':'4'}/4</span></div>
          <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-extrabold">
            {(['REST','ECCENTRIC','PEAK_CONTRACTION','CONCENTRIC'] as RepPhase[]).map((p,i)=>(<div key={p} className={`p-2 rounded-xl border-2 transition-all ${repPhaseState===p?(p==='REST'?'bg-slate-900 text-white border-slate-900':p==='ECCENTRIC'?'bg-sky-600 text-white border-sky-600 animate-pulse':p==='PEAK_CONTRACTION'?'bg-amber-500 text-slate-950 border-amber-500':'bg-teal-600 text-white border-teal-600'):'bg-slate-50 text-slate-400 border-slate-200'}`}>{i+1}. {p==='REST'?'Rest':p==='ECCENTRIC'?'Move':p==='PEAK_CONTRACTION'?'Peak':'Return'}</div>))}
          </div>
          <div className="space-y-1.5 pt-1"><div className="flex justify-between text-xs font-bold text-slate-600"><span>Angle: <strong>{currentAngle}°</strong></span><span>Target: <strong>{th.target}°</strong></span></div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200"><div className="h-full bg-teal-600 transition-all duration-150" style={{width:th.peakIsHigher?`${Math.min(100,Math.max(0,(currentAngle/th.target)*100))}%`:`${Math.min(100,Math.max(0,((th.rest-currentAngle)/(th.rest-th.target))*100))}%`}}/></div></div>
        </div>)}
        {trackingMode==='trajectory'&&exerciseType==='balance_hold'&&stabilityScore!=null&&(<div className="bg-white p-6 rounded-3xl border-2 border-blue-200 shadow-md space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-600"/>Stability Score</h2>
          <div className="flex items-end gap-2"><span className="text-5xl font-black text-blue-600">{stabilityScore}</span><span className="text-xl font-bold text-slate-400 mb-1">/100</span></div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200"><div className="h-full transition-all duration-300 rounded-full" style={{width:`${stabilityScore}%`,background:stabilityScore>=80?'#10b981':stabilityScore>=50?'#f59e0b':'#ef4444'}}/></div>
          <p className="text-xs text-slate-500">Lower sway = higher score. Target: 80+ for a clean hold.</p>
        </div>)}
        {trackingMode==='timer_hold'&&<TimerHoldPanel holdDuration={exCfg.timerHold?.holdDurationSeconds??10} onSetComplete={handleSelfReportSetComplete} isMuted={isVoiceGuidanceMuted}/>}
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-md space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-base font-black text-slate-900 flex items-center gap-2"><Award className="w-4 h-4 text-amber-500"/>{trackingMode==='angle_rep'?`Rep Log (${repLogs.length})`:trackingMode==='trajectory'?`Event Log (${repLogs.length})`:`Set Log (${repLogs.length})`}</h2>{repLogs.length>0&&trackingMode==='angle_rep'&&<span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Avg: {avgPeak}°</span>}</div>
          {repLogs.length===0?(<div className="py-6 text-center text-slate-400 text-xs font-semibold">{trackingMode==='angle_rep'?'No reps yet. Perform the movement to record.':trackingMode==='trajectory'?'No events yet. Start the exercise.':'No sets yet. Use the timer above.'}</div>
          ):(<div className="max-h-48 overflow-y-auto space-y-2 pr-1">{repLogs.slice().reverse().map(rep=>(<div key={rep.repNumber} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[11px]">{rep.repNumber}</span>
            <div>{trackingMode==='angle_rep'&&<><strong className="text-slate-900">Peak: {rep.peakAngle}°</strong><span className="text-slate-500 text-[11px] block">ROM: {rep.romRange}°</span></>}{exerciseType==='ankle_circles'&&<strong className="text-slate-900">Rotation {rep.rotationCount}</strong>}{exerciseType==='balance_hold'&&<><strong className="text-slate-900">Hold: {rep.holdDurationSeconds}s</strong><span className="text-slate-500 text-[11px] block">Stability: {rep.stabilityScore}%</span></>}{exerciseType==='gait_training'&&<strong className="text-slate-900">Step #{rep.repNumber}</strong>}{trackingMode==='timer_hold'&&<><strong className="text-slate-900">Set {rep.repNumber}</strong><span className="text-slate-500 text-[11px] block">Hold: {rep.holdDurationSeconds}s</span></>}</div></div>
            <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rep.targetMet?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{rep.targetMet?'✓ Done':'Partial'}</span>{rep.selfReported&&<span className="block text-[10px] text-amber-600 font-bold mt-0.5">Self-reported</span>}<span className="text-slate-400 text-[10px] block mt-0.5">{rep.timestamp}</span></div>
          </div>))}</div>)}
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between"><div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600"/><span>Confidence: <strong>{trackingConfidence}%</strong></span></div><span>Joints: <strong>{detectedLandmarksCount}/33</strong></span></div>
      </div>
    </div>

    {isSummaryOpen&&(<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border-2 border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center space-y-2"><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-300 text-xs font-black uppercase tracking-wider"><ShieldCheck className="w-3.5 h-3.5 text-indigo-600"/>Session Recorded</div>
        <div className="w-16 h-16 rounded-3xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto border-2 border-teal-300"><CheckCircle2 className="w-10 h-10"/></div>
        <h2 className="text-3xl font-black text-slate-900">Workout Complete!</h2><p className="text-slate-500 text-sm font-medium">{exCfg.label} • {sm}m {ss}s</p></div>
        {trackingMode==='timer_hold'&&(<div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-900"><Eye className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/><div><p className="font-black">Self-Reported Session</p><p className="text-xs font-semibold mt-0.5">Completion was self-reported. Camera provided form guidance, but muscle contraction cannot be independently verified.</p></div></div>)}
        {movementAnalysis&&(<div className="bg-gradient-to-br from-teal-900 via-slate-900 to-emerald-950 text-white p-6 rounded-3xl border-2 border-teal-500/50 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-teal-700/50 pb-4"><div><span className="text-xs font-extrabold uppercase tracking-wider text-teal-300 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4"/>AI Kinematic Index</span><h3 className="text-xl font-black text-white mt-0.5">{movementAnalysis.clinicalInsights.headline}</h3></div><div className="text-right shrink-0"><div className="text-5xl font-black text-teal-300">{movementAnalysis.recoveryScore}<span className="text-lg font-bold text-teal-400/80">/100</span></div><span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">{movementAnalysis.qualityGrade}</span></div></div>
          <div className="grid grid-cols-3 gap-3"><div className="bg-white/10 p-3 rounded-2xl border border-white/15 text-center"><span className="text-[11px] font-bold text-teal-200 block">ROM Consistency</span><span className="text-2xl font-black text-white">{movementAnalysis.romMetrics.romConsistencyPercentage}%</span></div><div className="bg-white/10 p-3 rounded-2xl border border-white/15 text-center"><span className="text-[11px] font-bold text-teal-200 block">Smoothness</span><span className="text-2xl font-black text-white">{movementAnalysis.kinematics.smoothnessScore}%</span></div><div className="bg-white/10 p-3 rounded-2xl border border-white/15 text-center"><span className="text-[11px] font-bold text-teal-200 block">Symmetry</span><span className="text-2xl font-black text-white">{movementAnalysis.kinematics.compensationIndex}%</span></div></div>
        </div>)}
        <div className="grid grid-cols-3 gap-3"><div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center"><span className="text-xs text-slate-500 font-bold block">{trackingMode==='angle_rep'?'Total Reps':trackingMode==='trajectory'?'Events':'Sets'}</span><span className="text-3xl font-black text-slate-900">{totalLogs}</span></div>
        {trackingMode==='angle_rep'&&<><div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center"><span className="text-xs text-slate-500 font-bold block">Avg Peak</span><span className="text-3xl font-black text-teal-700">{avgPeak}°</span></div><div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center"><span className="text-xs text-slate-500 font-bold block">Target Met</span><span className="text-3xl font-black text-emerald-600">{targetMetCount} <span className="text-sm font-bold text-slate-400">/ {totalLogs}</span></span></div></>}
        {trackingMode==='trajectory'&&exerciseType==='balance_hold'&&stabilityScore!=null&&<div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center"><span className="text-xs text-slate-500 font-bold block">Avg Stability</span><span className="text-3xl font-black text-blue-600">{stabilityScore}%</span></div>}
        {trackingMode==='trajectory'&&exerciseType==='gait_training'&&<div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center col-span-2"><span className="text-xs text-slate-500 font-bold block">Asymmetry</span><span className={`text-lg font-black ${trajectoryAsymmetryFlag?'text-red-600':'text-emerald-600'}`}>{trajectoryAsymmetryFlag?'Detected':'None Detected'}</span></div>}
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={()=>{setIsSummaryOpen(false);setRepCount(0);repLogsRef.current=[];setRepLogs([]);setMovementAnalysis(null);setIsPaused(false);setTrajectoryCount(0);startCamera();}} className="w-1/2 min-h-[52px] rounded-2xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4"/>Start Again</button>
          <button type="button" onClick={()=>navigate('/patient/dashboard?session_recorded=true')} className="w-1/2 min-h-[52px] rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black transition-all shadow-md flex items-center justify-center gap-2">Done &amp; Return<ChevronRight className="w-4 h-4 stroke-[3]"/></button>
        </div>
      </div>
    </div>)}

    <PaymentMethodSelector isOpen={isMethodSelectorOpen} onClose={()=>setIsMethodSelectorOpen(false)} onSelect={processPaymentAndAnalysis} onPayLater={handlePayLater}/>
    <WalletConnectPrompt isOpen={isWalletPromptOpen} onClose={()=>setIsWalletPromptOpen(false)} onConnected={()=>executeAnalysisCall('web3')}/>
    {showPaymentToast&&(<div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30"><CheckCircle2 className="w-5 h-5 text-emerald-400"/></div><div><p className="text-sm font-bold">Payment Sent</p><p className="text-xs text-slate-400">{SESSION_FEE_DISPLAY} sent to doctor</p></div></div>)}
  </main>);
};

export default ExerciseSessionPage;