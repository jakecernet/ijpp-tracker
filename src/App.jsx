import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, ArrowRightLeft } from "lucide-react";
import "./App.css";

import {
    fetchAllBusStops,
    fetchLPPPositions,
    fetchIJPPPositions,
    fetchTrainPositions,
    fetchLppArrivals,
    fetchIjppArrivals,
    fetchLppRoute,
    fetchSzStops,
    fetchSzTrip,
    fetchSzArrivals,
    fetchIJPPTrip,
} from "./Api.jsx";

import { polylineToLinePoints } from "./tabs/map/utils.js";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const RouteTab = lazy(() => import("./tabs/route.jsx"));

if (typeof window !== "undefined") {
    // Preload components to avoid lag on first navigation
    import("./tabs/map");
    import("./tabs/arrivals");
    import("./tabs/nearMe");
    import("./tabs/route.jsx");
}

function App() {
    const [activeStation, setActiveStation] = useState(
        localStorage.getItem("activeStation")
            ? JSON.parse(localStorage.getItem("activeStation"))
            : { name: "Vrhnika", coordinates: [46.057, 14.295], id: 123456789 }
    );
    const [userLocation, setUserLocation] = useState(
        localStorage.getItem("userLocation")
            ? JSON.parse(localStorage.getItem("userLocation"))
            : [46.056, 14.5058]
    );

    const [gpsPositions, setGpsPositions] = useState([]);
    const [trainPositions, setTrainPositions] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = window.localStorage.getItem("selectedBusRoute");
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn("Neveljavni podatki o izbranem vozilu:", error);
            return null;
        }
    });

    const [busStops, setBusStops] = useState([]);
    const [szStops, setSzStops] = useState([]);

    const [ijppArrivals, setIjppArrivals] = useState([]);
    const [lppArrivals, setLppArrivals] = useState([]);
    const [szArrivals, setSzArrivals] = useState([]);

    const [lppRoute, setLppRoute] = useState([]);
    const [szRoute, setSzRoute] = useState([]);
    const [ijppTrip, setIjppTrip] = useState(null);

    // Redirecta na zemljevid, če ni izbrane postaje
    useEffect(() => {
        if (!activeStation || activeStation.length === 0) {
            document.location.href = "/#/map";
        }
    }, [activeStation]);

    // Fetcha busne postaje ob zagonu
    useEffect(() => {
        const loadBusStops = async () => {
            try {
                const stops = await fetchAllBusStops();
                setBusStops(stops);
            } catch (error) {
                console.error("Error loading bus stops:", error);
                setBusStops([]);
            }
        };
        loadBusStops();
    }, []);

    // Fetcha SZ postaje ob zagonu
    useEffect(() => {
        const load = async () => {
            try {
                const stops = await fetchSzStops();
                setSzStops(stops);
            } catch (error) {
                console.error("Error loading SZ stops:", error);
            }
        };
        load();
    }, []);

    useEffect(() => {
        console.log(
            polylineToLinePoints(
                "mxlpvA}{nz\\@A??}F~X_[fyA_Qhy@uNbr@eUveAiObt@{J|d@ePnu@{CpNaCbO}AxJeFr[oCxQeChP_@dCs@zDeAbFuF~V_FtTiB|JuHn]oIza@}FzWwAlHyMjn@uIla@cIl_@aIf_@cHn\\iIv`@iIl_@iHf^oHl]oHr]wGn[kG~XqG|ZuGxZcIn`@cAxEoKrg@cPju@_Mdk@I\\wAzGaAbEADaDxM_HxXqHrXyIxZaMha@uRvl@cW|u@oWjx@oQji@sLv^uOhe@qM~`@gNnb@uJbZuMfa@{JpZ_KlZoNrb@aOdd@mOld@mM~_@mMj`@{Kl\\uLd^gMf`@aMx^aTho@mQri@gMv_@_DnJi|@hlCi^hgAog@n|AcV`t@_Z`}@eWdw@gGtQgTdp@ek@xdBk`@`lA_Qnh@y@fC{BfHeGbQcRzj@uUxs@mYz{@uVru@sj@rcBg^rgAeRbl@iSfp@}ZnbA}Txq@gTfp@_@~AqDjKiUbr@}E|NaRdk@}Olf@wW~w@EN????iC|HoL~\\wTjq@w[paAi[|_AkVhu@kXvy@iQhi@aKzZkCnIub@ppAkKn[_Rdj@aWxs@qShl@ad@bsA}O|e@_AvCum@njBqHxT_B|EuBjGCLeNva@qGnR}E`O}Wpx@_GdRmLt]{HhVw[|`AsHdUwG`SwP|g@iI`WcVrt@sUjs@qWnw@kOnd@wOne@sHvUgN~a@mOne@iOhd@oOvd@sOze@aP|e@yNzc@{Nbc@kQhi@_Ptf@oRtk@_CpHmEzMoNpb@uOpe@gJvXiLr]qMl`@mKv[qLj^yNfc@gNlb@_Pjf@sOte@iN`b@mN~b@uNhc@gNlb@sMh`@mMp`@oLz]qMr`@uM`a@cDpJ}IzXiKf[qKt[kLn]eKt[yKp\\cMf`@qN`c@sO~d@_Lr\\mLj^iKt[}EtN????AFcDrJaJfZcH`WmLjf@mGz[aFxZwBrP_CjRcBhPiBxTqAzQaA~Q_AjRe@fQe@xS_@hWe@th@]nl@]jl@Wri@[zs@_@hh@]lm@c@rm@_@vj@W`k@]de@W`f@_@nn@k@hq@k@ra@iAbc@wBld@yCxb@eEbg@cFnj@y@dJsFpm@wEvh@mFjk@iFfl@yAxOUlCgEbd@yEdi@oHzx@{JjgAsF~l@kMpvAmOjcBkMhvAyJnfAsNz~AyH|z@qFdk@mDxYgIni@eGt\\sFrWqF~TqErP}CfK_IzVuL|\\oHdRyNv[uDbIaAnBgIlOsKvRmJnPqNvUcHtLyF~JgHtLkFvIyEtHmGjKgBxCaLzQkJlOuI`NeI|MkHpLyNvUiIpMsKrQkItN{MvTqJbPkO`XiL~RsKbQyErI{B|DePpX{HtMePvXuJhPeLxRaIvMsPlYyJbP}OdWmKlOyH~JcOtOoDtDsJzI}FpEaDdC_PbK{F`DqHtDoJ`EaItC}LxDaJvBgMbC}IjAsMfAwMj@aJHs\\{@yDUeI_AeMcB_YsF_]oHgEy@}O_DyNeCoSuBqNs@kEO}M?{D@iFLkLf@oE`@yD\\kEf@oD^eCd@qGjA{Cl@_GnAmCn@_EfAcErAgInC_FlBgHxCaMrFcGxCyJxEyE~B_GzCoFnCeMjGmHrDeIdEcRhJ{E`CoRnJyGfD{NlHaFbCmSbKiGbDkUdLwFzCmTjKyQdJwGdD_OhHeG~CyKpF{J~EoPjIsG`DqQ`JyGfD_QzIyInEyUlL}HzDsO|HwIbEwPlIiIfE{NhHgIbEuNjHmEzBwHtDyL~FwJ|EuLdGkN~GaMrGgKjFcLtFuMlH{M`IoIdFsGrEuItF{JhHyL|I{LbJoLpJcMfKoLpJsLxJmKjI}KbJuLvJuMpKoMdKkN~KoO`LsOpL}OdM_PtLwOlM_IxG{FvEyHxHwH|HyHxIoHxIqGxIoGjJ}G`LgHxLcHhMcH|MsHjOsH|OwHlPkIjQwHtPuG|NuItQkJjSuIhRoI`Q}HnQeIhQyIfRsJrS_I`QcFhL_FpLeF`M{DnK}EhOiEhOgEhQaElR_C~M????Kj@w@pEgDfWcBdPk@hFw@dKo@hHkAtQgAlPcA`LgAtMgApOoAdSwApSmAjQmAnQeApPuAlV}AdVi@jKeDnc@qA~UcA|NiAfYk@hRQzLDtOx@d^hAl]f@`M@Fh@nHJ`BlBhUlBnQtI~q@`RlqAfMtfAxI|i@pGve@rBrRzApXx@zUb@pS?nW_@xPs@fSu@jSo@dLsD|c@}CzWkCfPcE~SiFnVmFfUaJdZgKxYaIzUiStk@kLx\\?@qBnGcCvHkFrT_DfOaCrMcK`r@kHrm@iIxr@wI|m@iIfn@mGrk@qCtXoBnS}CxWu@dGyAdM{B~RkEt_@aGdk@{Fpl@q@rHe@zE?DoGfl@oGfl@gHpn@{Gfl@_F`b@k@tEmAfKsGjp@yFlu@sAzVWtE]xG{Cdq@u@hXeAvl@WfWSpc@Jvj@b@tYp@nZ~@x\\z@rX~@j`@x@b[v@p\\bAn[fA`b@zBd{@~B||@vAdi@bBzo@d@nTp@`Y`An\\z@f^x@bZBbAH~CVxIlAtd@jAt^tAlg@pAzd@j@|OtA`YzCze@zBlVnBlRTrBrA`LHj@vCfUpIzj@jFr^`I|i@`DfTnJzm@vIrj@jJfn@xH|i@`ChQ|Ep\\rHdg@bCfQPjATxAfC|PhCnQpEz[tD~YfEj`@lBlVn@rL|@tS|@j^d@~ZQ~PW|Ne@hLm@vLo@dL_AfM{BtUqEda@oH~r@{F|g@gCfUqDb[}BpScCjTaFbc@kEv]yIhs@_Jpw@gEp]_Fpc@gDlXwJb{@_C|SsCfXaAhJeGdk@eAzJ{@fIaAhI}A~MyBjSuBbTuDvd@m@hI_@fFiA|OcBzYeBv[kAlVy@hR_AlPq@bL{@vK}@|J_ApJ}AzM{AdLgCvP{BdNsBpLeCpNcDhReAfGgB`Ks@fEiEnXmCzReHng@oDrZmEfa@uBxTqBdXcBrWsCfk@w@rSg@tPKtC[nK_B`n@}@|d@m@h\\cAna@iB~}@k@nSiCxdAy@ba@oBzu@y@b\\oB~u@yAbk@}@x^iA~a@aAza@cAd_@g@|QkAld@_@|PYzLGjCWzJ_Ah\\y@l[o@pUk@tWs@f[u@zTo@nPu@tNk@jJ{A~QsBtSoD`XcDzRsEjVyM|m@_Jv_@}E|RsFdVmFjXsCbQeBnLqBxPeE`f@u@hL{@nQc@dMc@fRUdSAhNRhR\\xQRpIfAvU~A`YXfFFjAtDjh@lAtP`Dlg@|GpcAzDtj@pFjx@v@tNdAbTh@jSXbR@~B?~B@tBI~QQbOSvJWjJy@hP_BdVwAvOwAbMkBpN_CfOmEpW}ClQyIhf@aHd`@sBjLcHp^}ErT}DfPuFdSuHpUkFhNoFjMcHpOkIlPkG~KsQhYyJdNuMrOgJbKaG~FoFhFeMpK{K`IwTxNg^tRw`@hS_WnNoO|JoL`JoL`KkMxMqQxTaH`KiF~H{L~SkLvToP~\\uJfTmKnW}FnO_GbR}GlVgFpTuAxG}K|k@cQjbAwH`c@wKbn@cIjf@cEfX_CxRuA|MeB|RcAhQ_@nHm@pPc@rOQjNS|RUf\\MxXKxUS|[]v]a@lTw@hY}@|QcBjYkCt\\}BrZwB~U_CzZsAvTwAvZe@bQk@hZM`WAxS@vb@Nxg@@zHJn^L`e@BpYJ|S?@?`@?dFFp]Phk@Ntf@@`FLfb@AnKHjQPpw@L|l@Rfy@Tpz@EtVUtQcA|S}A~PqBdPkBjKmDvP}FzRwGzP}GhNqFfJcNbRgH`J}D`F{JnL}HtJ_\\x`@kXp]uSvYmY~^s^|c@}UrY????gTtWmEpFg\\~`@eT~UyZz\\{Xx\\{MhP{LdO_DvDyGfIqTbXqMdP_E~EgUlYiHpKaO`XgGrN{ErMmEnNcGpVmDbSeI~h@}Mx~@oIrk@sHbf@uF|ZeIf^{CdLmArEkIdXkGpQ}EhMkRbf@}h@dsAsH|PwG|NoI~SkJ`VkJvUWp@{IrUaNb^_IbVsF`SaGbX}EbWuJfk@}Mlz@wLjs@_Gr^e@pCsAhIiEbXqNdz@uLzs@e@nCKl@oJrk@sItg@yMhz@kFn[iAbHiAzGuL`s@qJbk@aJlj@wI`i@gL`r@eG~^kM~u@kF|[wBpLoElS{FlSoE`NmFxMeEdJuEfJqHtLcMdPwJhKkTbSu[bYcQpMcJlG}I|EePnH}HtCkMlDuMfCsAVy@NwNbBmNv@iILcKSqL[_NoAkLcBiLqCmLaDaHgBcJgCiJiC{NuEk]}JiNeEmBk@}Bq@qSiGyXgI_UwGqVkH{c@qMeVgH}Ac@eBg@}QoFmUwGgQiF}c@uMcMsDeKwCuCy@sS_G}VkH{M_EeHaCcPuEmd@sMmLiD}H{BaBe@iHgBoHeBwLiByJgAcLi@c^S]?cE@iPDwTNgWJw@@}KFkSJum@VeCBeD@}OJkXb@kSn@w@BiFXyQ~@c`@fCgF\\kF^uN~@{KlAiKhBwCx@gKzD_GtCgGdDcN|Im\\bUyZzToUjQwR`PgQnOqKdKwFhGuDbFuDbFQ\\_GvKsElJ_D~H}ElOqElPcM|k@mOjw@qGn_@iG~b@OnA_@bDiF`c@qC`YeBrUiBz\\kAjTmAvZc@hNc@pTe@x[GnEM`H]p\\aAvw@i@|f@o@zd@s@pr@GvYN~Qd@dOh@vKbBbWvC~_@|Dhh@lDnd@tBvXhBxRhAnIvB|NlBfK|CzNzLzf@bUp~@rPxp@rMbe@zElMhHhPpIxOvJvNzJxLHJrBxB|CfDtI~HlGtEjJ|FxSfMp`@bVdW`PbM~IlHtFjEjD`FlEpEtEzDhEpFdHdEtFJNpHpKz@zA`F|IfEdI`HpOpBlFnDlKfExM`DnLtAjF`@~AtBjK`DpQrC~RlApKjApMl@tKb@jJ\\xNZnYBrLIvp@Ojx@Epb@Ex\\@``@?bCOjc@K~a@K`KM`J[tOc@dK}@dPeArO_AfLsAnM_AtI{BrPoCbQqCdOCLoCdMmB~HaDzK{CrJcG|OmDjJyEnKiDhIiDtHsClFcDtFcE`H}EtH{GrJcGxHoFnGeI|IyJjKaGvGsIrJaIpI{EhEoXxYoVlX_UpVaSvSuT`WkFjGgGvIcEfHwDjIwFlNcEbNqDxN}AxHoB~McBfN_AtNc@fMUzMM~h@d@~o@I|m@Mfe@UdOk@~M{@jL[hEqAvMgC`QuCdRuIdd@sGz[gS`dAySvdAqSpfA{Oxw@wOjx@cP|w@wOjw@gMjo@cU|iAwKjj@iEfQ_FjP}GlPwGjMcGtJ}GjJiPxOsHdFwHpE_FjC{EfBeGjBmFlAy]pIw]~G}@P{a@zImXtFsX`GcX`EmK|@iKVsIQmKe@cKiAqJgBoU}GeUyI{Y_LcMsEuKmCyKeCqJu@uKQcLJ{KlAsIdBeIxBiI`D}HpEyHzEkLfKyD|DeFnGmFzHoG|KqGxN_Nh_@aNxa@wHhXoB|HkCbLgIha@_Oh{@aShmA_Nfy@cBdLs@fDqI`h@oGh_@sGf`@yJzl@qFb[uFhYsFxW{It_@}G|WgG`ViL~_@cJhYkGrQ????uExMoKjY}Np]cPx^wPf]_PbZuNhWsNvUeMbRgLfPiKjNeMbPeVfYwTfW}R`UaQzR}NfPuHzIiCnCqCvCeRfTyQtSwPvRkOvP_NxOkMlNeLlM}BdCoCvCiGlG{DvDeFzEqHrGiMpKaKlIiMnKaHzFaBrAsIfHeFzEsIzIuGnHkHxI}EnGkO~R_IfJmG~GgF`FsE~DeFdEoGnEsG`EsEbCsGbDcL|EuRpH_MfFwKbFuFdDcJ|FqGnEkEnDkF~EyE|EiDtDyExFmErG_FtH{CfF_DbGmCjFkDtHcC`GcDnIqCtIoChJmFxRkHtX{ExQoBrHsF|SsGjW_Jh\\oHtYeIxZoFrSsCbK_DdKiE`LkDpHsCrFwD~FuEbGqDxDwEjE_DhCgEhC}ExCiF|BqFlBkG`BmIfAsGXgHLuEKeIw@aG}@gG}AmJgC}V_H_T{FiIuBmEs@wEc@oEKsIDcGVkANqD`@}G~AiEzAgF`CqHzDqNnHwOjIuCnB{D|C[VqDbDgDxDsDpEsCdEmEtH{KrQ}AfC{EbHsQpV????iDtEeD`FiR~XmCpDeDpEsErFuA~AkC|CuEnFiErFyEtGaFfHaFrHcEhHkDjH}CzHoCxHaC~HuB~HeAnF_BxIwAxIgC`QaCbQgCnPcBvLoBtMcBbL}A|KcBlK_BnKwAdKuAzIqAbJAHs@jF[zBeAfIu@`IeAbKy@|MmA~NsArOo@rHy@zLeA~LeAdMaAzL_AzL_AzLaAzLy@fKg@`H{@|K_ApK_AlKmA`JeAdIwAfJwA`HwAhG_BjGiBtG{BtGaChGmC~FyCzF_D|FeD`F_DpEmCnDaCtCqBlBkDfDuEvDwFzDiEtCgHxD{HpDcHbDaHjDcJbEcJlEuJtFuJdGiKjG{JdGmKlGeIdFmIzEcGrD_IfFkG~DeG|D}FzDuEfDsKdIuKnIaDjC}DbDgFfE}DfDgFpEmF`FgFxEmFtEeFvEuEjEiElEoEhE_DxC{E~EkDrDmC|CcElEcExE}FfHkDtE{ElGaFlG_FtGaFxG{E~GsE~GiEtGcEpGiExGeEtG}DtGwDxGuDvG_DbG}CdGqCzF_DhGmCbGsClGsCxGgChGgCpGcBtEeCtG{BpGoExMgD~KuB|GoB~GqBtGs@vCqEtOoHbXyFbScFbROf@{@rCiExNaFrQgFnQwEpPoEbO}DnMmDrKwDxK{EvM{E`M_G|NkFvL{ElKgHlN_HjM}GjMeBzC}BfE{LnUgHpMeGlKaFfJsFbKgFrJcEhIcEzIyChHgDxImCxHwDtL_EbO{B~JwBnKYpBOp@oA|HiAbIeAlHkB~NkB~MkBjMcBpKkBhJqBvI{BnI}BhHmCvHiCfGuBlF{EvKoGbNqG~MmGxMmFdLiEhJgE~IyDfIaFvK_BdDkDnHkDpHgDxH_DvHyCfHaDnI{CfIkGjRkDxLmDbM_D|LaDxMsCrMiCnMmCvMiCnMgCpM_AvE{@tEGVcCzL{BdLwBzKsArHcBtLaArIm@zHi@bJ]nIOpIIbI@vHJdHLvFX|GJlBPfDXxDx@fIz@tIfA~JfAtJ|@jIn@vHb@nH`@dHZjINfK?|JKvIW~Ha@zHg@rHs@jHw@jH_AvHgAbIiAzHeAxH_AvHy@hHo@~Fa@hEg@bIc@bIWtIU~HWzJ[fKWlH[`Hg@lIw@tJeAdJmAbIwApIiAzFqAlFwA`FgBvFuBdG{BvFyBlFmC`F{BbEeBlCcBhC}CbEmCrDyBlCq@z@o@v@mAxA{BtCuGzHcGjHqFpGgFfGmEpFiEvEmE~EiE~D{DfDcE|CwDjCwDvBeDbBsCrA_DpAsC`AuElAsElAcE|@eDj@{Cf@qAT_ANwDp@eGfAwFdAmFnA{ElAiFfBkE`BoDhBiE`CkDxB_DvB_DhCyClCqClCsC~CgCtCsAdB{@fA}AtBk@t@oCrEcDvF_DhG}C`H_DbHiDlI}C`IiCbHiBjEuDpJaEbKoD~I_DhIwCvHyChIqCdIuBtG}AvEkAnDsB|GaCnIeCrJqBpIsB|IoBpImBhJsA~G_AdFqAnH_A~Fs@nEWbBs@xEqAxIkA`JcAbI{@hIg@|EaApI_@fEo@xGqB|SgAdMkAjMeAfL_ApJmAtLWtCm@xFsJvdAoBzVcAhQs@lSYdXHrZRzOBhLrCt`BJxIrAv{@JvUGlWi@pNu@jMeB`R{ClRcEtRqFnRgFfN}G|N}GbLcItKcIbJ}JzJsb@x]cJlHo_Arv@osAfgAip@`i@iVtRcf@v_@}b@l]}FnEgKbJoHvGiGhHuHnJkI~LiHjNsI~RoJvWqK`[oIhW}J|ZgC|JiA|F????_@hBm@zC{BfOkB~OeA~PaA~\\KxXAzJNlJv@bQvAtQlBhRrBxO|CpS|Fp_@|BxOnIjk@hLfu@rKjt@|Kft@rD~UtDtWxD~YrFzf@rDx_@pFpq@TtCnBxZ|ApUr@xKx@hLr@bLx@pKl@bHt@lHz@nHfA`IvAtIlAxGnBhKrBjKxBjL`BzIbBdKtAxKpAxLp@pKb@dJZnJHnIAdJMjKSdIa@bKc@nK]dL_@fKS|IQ|HC~J?|IHbIBnKJ`LHfMGnKQ~Le@tLiAdPsAfMyApJqBjLqBdJ}BdIkCxHaErLeF~MwGvPkFfN_F|LiDtI_CjFsBlEiDpGmFpI{FxHqFlGkFfFqFfE}E`DwHzE{G~CcGhCqfAn`@mIvC_N`FiLrE{GdCgDjAyJ~DaJjE}ChBeBbAkBxAcLdJyLzM_S~ZcKzUiIzWeM`m@qEb_@qCn^e@xPc@x]TbY`AxWvBpYvDpc@|BhThHjs@zI~z@fEfe@zAj^XtYe@nZ_Cvb@aEto@cD`h@oDtj@gD`h@o@rKaFry@iCjr@yBdk@kGvqByNnuEcB`l@aAfe@Mdl@b@`_@dBlg@f@vNpDx~@XjHpBte@jCzn@|F|vAxExgAdBxc@~Ad[zAtS~CnUzClOb@xBnFtRvDtKfF~L`A|B|MhXrVle@rF`LpAhCrH|NrHbPzHnPtHhPrHnPxF`MxG|NbF`L|E`KhElJ`FjLbEfK~DxJnFvMvGrPfHtPtGxP`FtLnGpO~FbOzFtMjF|L`FrKlFhKdGjL~GfMlG~KrHpMlHzMnGhLfHxLnGhLhGzK`GbKjF~I`FrItFzIlEbHlEvFdEnFlEvE|DjE|DjEbGpFdIfHvIpHzHfHtGlGvFjGfFrGvDpFhDdF|AlCb@x@lCvE~C`GdIfPpIhQ~HjPfFrKtBzE`HvNvG~MjFbLjFvKpGbNtGzMdGrMzEvJjFrK~EzK|D~I`DvHfC|GxCtH|BrGjClI`DrKxCpKdD~LdDjN~CpNfD~OrCtOrC~OrCrOnChOrCrO|BdMjDfRdDfRpDbR|DfTpDnRvEpWvD|SfAlFzCbQbCvMvC~PxDxSfArG`BzIhB|JvBbL|BpMvBfLhBtJbAlFpAxFfArEvA~E~A~EpBpF~AnEfCfFzCdGrEzIpCxEfInO~ElKbDnI~CdJ|AhF`B`H`BfHxAxHfA|Ht@~Ep@lFh@hG^xFb@dHP~GPlHFhI?|FIdHQzHUtIm@hNs@jOk@pOm@`Ns@nPm@hNm@|Ns@bPq@dQy@pRs@hPk@~Om@jKo@zKe@fFs@bHm@bGeAtH{@bG_AhGeAbGqA~F}C`MqAhFiBfGiBnFmBhF{BjGkCjGeDxGqClFoDlG_D`FqCbEeDtE}CzDaEnEgEvEeFzEsHjH{HjHuIfImJ~I}HnHmJxIcKrJsLtKgJtIcK`KoIvHyLhL_MbLcKzJsLzK{KlKwLxKsQxPiRlQmNpM{\\t[_QbPyPfPkF|E{F`GaEjEyAvA{BhCcEnFwEzGmDxGaDjGeEtJeDxI{CtJkCxJaArEwAnG{AxJeAxH}@`Iy@rJg@xHa@nJSnIIhI?~IBbHPvG^dJh@~LnAbQ@PlA|QpAfQz@pK~@`In@tFvAlIlAdG|ArGdAbE`B|FhBlFbBpEfBjEhB~DpB~DzAxCtBbE`F|IbH`MfIvNtF~JdGvKtHzMpI~NzJzQdItNhHvL|CzEpC|DjCjDjBzBbB|BdCpClDtDrEtEtEjEnFrErFbE`FvDbHrExNtJ|M`JnNtJvD|C~O`MxNnLjMnK|KzJlF~E|GjHpCfDjC`DrF|HtHnK`LdPpMrQzLdQ~JnNnJ`N`F`IxDlG|C|FjCtF~BpFtBdFfDtJtDlLjG|T`GlT|ElQpCxKrBnJvAzHvAhIjA`IjA~JzBxRdCbT`CfTvAxL~@fK|@dLn@nJp@zL|@`Pt@dMl@zIv@lHbArJrAlJdCfPbDxQ~EjW~EzTxCdK|C|JtDbKxD`J|E|J~GtMvGxLbHtMvIbPtJdQ|IpPhJxPpLvT`ObXhP`[|R`^~Sp`@vMbVxO`ZfSh_@`IzNhD~GjCdGpClGvCjHvC~IrB|FlChIt@`ChC~GxI`YtI|XpGtSrIlXhL|]xGnSpK~\\lGhRrDjJfGnMzB~D~ApCT`@hI|LxEvF`FlFnJzIb@\\zCbCPNzK`IjXvPrYxP|VpPvU|N~U|Nb\\lSvFdEzGlF`JfIfH~GjG`H`IxJrIzLjOrSz@jAj@v@rEjGdH~HnG`GdEpDxFhEhChBpEnClHxDrD|AdDxAlDtAzHjCrMdEtMpExLjEdM|F`T~JxXpOxJxGxLnIdJzHbKvJjHrIrJrN`FlIfMhWrNrZ|MnZtH~QtJzWjDlKdFjRnDzN`AtEtF`[xWbzA~N`q@|G`XfR~r@VbAjArEpCnKpG|YrCtP~ArJvCbUfAzJtAbN`BpUjBj[nDrm@lBb_@fA~Z`Cj{@`@bX^pTp@v^\\~Nl@~PjAjRfAxLjBrNpBfKdF|TpH|ZrDpQxBhLvAtI|B|Qn@~Gd@pHn@bRBhdAOxo@[xV_@fKa@pIq@fJaBpOqE`[{EhZiElWmAxHyGnf@_AhJiLpwAsHn_AiElh@sFvv@kAfVc@xM[tQ?zb@f@tj@dA|sAj@ta@`@nUx@rTfAdSVbFx@~NXrF~J`pAhD|h@vA|[`An`@Nb[K~P]dRo@xQoAfS{AlSaBvRoBtQmCrQwI`j@oSpjAyI`i@cBjK_CxQmCjWuBbXkAhRQjEa@hMY`Pi@l\\O`TIhOBjMJpLRzKp@vOhAlOdArJ`BhMzQhlA~BfL~BxKrCzL`FfSxEpPrGtRnGhQpGrObH`OjNzWtIrNpIjMtMjQjXd^hXt]~HpKhOjUnHhMxHpNbIbQjCpGhCjG~AdEvFtNlKlZrDnLrCfKjE~QjDhQhMpx@PjAzJvn@rFla@jGdl@tEvi@vEtl@jAbOb@tFrCx^`IvkAdB`SXhD~AdRpEhj@pBfVxDdd@LnAL`BvFxp@lGdv@vFhp@zCh_@xAlQNlBhGjs@zIreAzGbx@fHd{@tIvcAxCj\\dDvZrDh\\lGnd@tEf[v@rEr@dE|CtQ|Gp^`ExRnGzXxJra@fIf[nO`h@dNpa@rQ~f@~K|XjMrZpE`Kp]tw@lF~LvAbDlOz]lZnr@fe@reA`DhHdA`CxKhVvNfZvPb\\|FxJrDpGlMlTnGzJhHfLvPnVxQvVfl@|s@~b@hh@zXh]@@xBlCjT|WnHdJbUvXr[f`@jXn\\~U~Y`V|YtPjUfL|P~@tAhBrCxWna@`N`VrJpQbQt\\lDrH~KtVfQ~a@hOp`@vIfV~IhXpVhz@vI`[jTdt@hXl~@|Sts@zW||@dZjcAdY~`AtUpw@xBjHxFvR`FtPfFhQhFdQrFvR|FxRtFxQzF~RdG`TxGnTtGlTfDfLhD~KfFtPhEfOdEjOzE`PfF`QlFfQjC~IlDlLxDxM|DpNzFhQrF|RnG|TzGlUjAfEtEnOhFbQxFxRbF|PjEhPvE|Q~EdTvCpNpCpNjCfOjCrOrBrNnBzNlBfPzBzQnDp[bBtOfCrSvApMjAdJ~AfMvA|JpApJnBjLtBrLrBpKhBxIjCxK`CpJzCjKhCdJ`DlJtDxJnDvJtAbDjMzXvGjM`HnM`HbMbH`M`H~LzGzLnHfMxH~MxGhL^n@xH`N`JtO`JjPhJnPfF~IvCjF`J~OrJnPrJbQ~JbQjKtQzKrQ|KzPzKzQhJjOzG`LdGhLdGtLxFbMlFhMnFbNtEpNdDlLd@dB`EtO`DnO|CrP`CrOxBdOzBxQrBjSdBpTpAdT~@~Sn@tTXhWIvROtPu@rWeAdS_B`SiBxP}@vHuC|R_DrPmCtMiDdNoD`MsEfMwErLuHrOeIpNwIpMyJpLwKvKgKbIaK~GqHbEcL`FaMbEyMzCaMpBgKrAsOlAkNz@mMj@iMRuNHoMEqL[wLg@mM{@yKaAiKmAcKuA{KmBaLwBkJqBmJeCsJsCeJoC_OmFkNwFoM{FsJ{EiGeDkGsDyFeDwH}E_IkFoIeG_MaJkMcJ_LcIyLuIsL{I_C}AmI{FyKgIkLiIaJ}GsHqFuH_GyGyFqGqGcH_H_IwI_O_RoNgR{JyMyHeK_JkLiAuAaGeHiGwG_IqH{G{F_GwE}OoJmYiOiS_Keo@wZqFgCeW}Kig@iUwRqIkGqCcUgKiRqIm_@aQiTqJsNgGmSeJuTyIeQqFeOoD_FeA}VoDqJw@}Fc@gc@kBeFGoKNqb@vBwFd@aRfCyTnCE@i|AbSq@HgT|C}UdD}Dn@wHfBmIjCkDzAkG`DeKpGsDrCqAlAs@p@yH~IcIfLwHfMaGtKsGdNABGP}@|ByBzG}CxLyBrKwC|R}A`PmAlQo@tMQjMAnJ@~Kx@no@`@vUXhOdAjk@`Azi@vAtu@bCtqApB`m@n@fSbAp\\\\hOTvMP`XArQ]tXq@`Vw@jNgD|b@aDnYoFv]gBlJ}@zEQt@{Hf\\gFhRoGrTsQfk@yQlk@}HtVaL`\\iF|MoBtE}BpFeCzFkIrQiHzN}Y`j@kXbd@mTp\\aZfb@wUn[oNjRoYl`@qJdMuH|JuHhJmKdLoAvAa@`@eFlFiSxQkEfDqL|I_UtNuFdDsCbBgHfEoQpKeWhOwKrGoIxEw[pRc^tSqQpKgc@nWC@gBfAc[bRib@zVwj@v\\iWbOe[`R{a@hVmHpEwF|CwNxIaMjHmDrBuCbBeFzCiStLgQbLiDtBaMtHuMxHmKhGqLnHgBdAuKrGiH~DqDrBsHhEsVlO{JjGwFxDaFtDmHfGoG~FyF`GiGbHoElFaHrJsEhHqEhIsC`Gg@|@qFvM????_AzBeDnJyF|SiGpV{DzTmDdYcBxRwA|U{@hUc@rMk@z\\IxXTnm@r@pZdBta@x@zPjBdUjD~\\|C|WpDjW`Gr\\jFbXrHj\\|J`^pJ~Y|Nt`@`O|\\fSv`@`RrZdQvV|OjSnOzPxMzM`QjOhRvNn]pW`g@n^fa@~Y|KdIxXvR~QnNlQzNdN~L~RfSdSdUn@v@tE|F|QnUxW~\\dOdR~LvO|^be@nShW`\\zb@tNdTpU~`@hGjMrErJjGpN~IhU`Nt`@vNni@|H`^`FxW`EfVnC~SjDnYdC`Wx@pKx@xM~@nStAhc@j@hX@lBFfHFlJh@`o@Hj[f@tpA\\~f@Thf@Nx^JrIV~a@Tpb@Jt_@Nx\\\\x\\l@`]xAl]hBnZh@lHtCl[xCfVlDxVbErVdDpPfDlOrHbZ`HvUfG|RfHjRbHfQ|LlXjLdWvIjRjAbC|JtTbQh_@nOp\\hNrZlLfWnCxFdDdHzHvPfItQx@fBjNp[vJzUbMp^dKl^pIh]dHp^`AzFvF~_@pEx^pDl\\zDp]`Db[pDr[~C|YtCjW~BrTdCnSdCpRxBnO|CbQfDxPxDvPhDnO|@`DpC~KbCnJ~BtIhDzM`FlS????rArFbGfVrDzOxDvRvC~Pp@fExA`KhB|NfBlS|AxRz@tQn@dPRxHt@``@LrXLdo@Rl\\XnVh@~VjAxYhAfSxBv\\|Bb\\|@lLbCt]rA|TlAzYt@pVRzKRzODpTa@~|@}@`jAu@~w@e@hm@e@rj@IjIUzXYn`@UnQg@j_@g@tTUbIcBxf@{Cp{@eBvh@{Ave@MrD{@jUEr@y@hSeAxSgAhPw@jLsArPuB~TaH`m@{@nG}DxXyB`NqBhLiExT}C|OyCzNsDlOaDpM}CpLuD`NqErOwQrj@aEdMwObh@kIv[eDhNoD~OiHx]iDpQaHdc@{Ijk@gClP}En[eD|SsFv]CR{AvJgJnl@gGr`@g@hDeBbLc@tCgBlLcCdPmIfj@kEdXqEdYgCrPyD|VqBhMuDpViHhd@qCvQsFj^uC`RAFeCzPyBvPgDxYwAxMyA~NoB`Vo@xI}@dOeAzSw@tRe@lM]dNSrJWxNOjP?|PBzZNlUXrRh@lUp@~St@xPxAlXvBhZlCdZ`DzYnB`PnFv^tCxPjBpK|CtQdCpN|Fj\\nFf[x@xEdF|ZlCnSfBrPpA~Nx@vOD`ApBlo@bAn\\\\hMf@zOv@nVfAh\\dAzZd@~Kh@pI`A~KzA|LjA|HlAjHfB|JzApGhC|JvFzQjCpHjDpIlCdGpE~IbDpFzDrFrC~DlD`EpCpCnClCxF~ElDfClGxDdHlDfFzBlDnAzF~AjKxC|HvBnEzApEdBrEfBjGvC~DpBxEvC|F`EtElDrD`DdDxCjDpDtCbD`CrCpCdDrFhHxEvF|HxJbMfPjHrJ~ClEzGxJjCnEfD`HpDrHnBdF|DnLtBvGtAlF|BrLrApHtAbJ`C|O`CbQzB|NfBjJpAjGbCxKvAvF|CtKdD~JnClHhD~H|BtF`HfO`Tde@zF|LzIvRtJ`TtJ~SbJfS|E|KnCxG`D`IpBrFrCbIfCnIdCzIpEbQzPpr@xIf^xE|RpKjc@dHnY|DlPlBrHpB~I~AhHpAlHzAjK~AhMx@`In@lI^dGVrFRjGH~HFbPKpVYbWStQUnRGvL?lL?fLT~NZxKZrIf@`Kp@fLt@dLzAzQtAjMtBhR~BrQhA|GlCfOxCnNtB`J`FhSnDpMtDnMhDrL|CxKpDtMnIhYdIdXbGfT~GhVpDlM~ErQhGfT~GbV~G|V|BhIlCxKbBjIbBrJtBpNxAxLjArMn@xK`@`KRfHDdDFtGB~@BpOEhc@O~a@Onp@A~ZEhSOnMUdNi@lTk@pPi@nLiHfvBi@fUG|RNbPd@bNdAdOnAxLlBzLlCtNtEhQhHhS~InRfd@ty@l_@vq@rFvJlj@lbAvT`a@xYnh@fHtMjKbRdb@vt@xDzFhCdEbFxFdBdBhC~CfJdIpGtErI~EzFlChK~DbQrFrMzE`IdDzGdDzElC|FjEbJrHpLfLtOtOxLvLvMxMfKlK~JxKzBtCdG~IfEbHnEvIzDjJbFtMPb@hAhDXv@|CjKdH`VzFpSlHlUnEtNzIzVfAxCNb@jDjJdNl\\jGvNjI|QzGtNbHfO~HfQNZjAhCfDlHpS|c@|Qt`@r\\nt@rD~HxGpN`AvBnS|c@fKdU~InRfLzVpE|J|@pBjH|O|ExKfB|DjJhSlRta@`@z@xBpEjE|IrChGNVxHbQtGlNpChGpKxVpDnJjAfDbC`HnA`EfE`N`ClJbCxJlEzS~CbQ|BlOjCxSlBlTpAtQJfBr@bN\\zJVbL\\lWLnPBtFHlYNhb@DlUH|f@Pxc@F`\\JrZ@nd@Cd\\GvO?dCWpU_@nVi@xTIfDc@dUMdGCnAIjE}@|f@k@lV?Dw@ra@o@vVoAt\\aAnT_BpVaAzMaBxQq@fHgB`QuBrQcFfc@qAlKyDn^eAxKmBrUiAfPgAvRu@vOe@tKm@fP}@nVkBti@qAj^kBri@gBbh@aBvc@iBni@_@fMa@|NS|KOrLKvJA|S@tQNpLRfLl@dVb@fLfA|UzBr\\`BlR`CnYfCxYbC~XdB~Q`D|^tC`\\hAnLfC`Z|BbVbCdYxAnPdEbf@`Cx[x@`M|@lQ|@nR`@hL`@tMn@|Up@xg@\\df@?d@????Vvp@@xEHhXLz]Tz|@Nzt@Dfm@Aj`@GbOMlKi@xWi@pQs@|PcB`XyClb@cFnn@}D~g@_AjNeBx[kAvW?Bi@tTOtZNdZFrCR|J^bO|@bQlA|RjAfOpChYdC~S|CbWd@nDfC`SfDnXPtAlFhc@rEdd@nBlVbA~Oh@dJj@zJRvEZvHXvGl@dPp@fVPfI`@|Ul@`a@b@|Xj@bx@Xja@Lrg@Lxw@Ltk@R~|@Thk@Pbs@F|[F~YVnx@H`_@PhdAPt`@JhZN|j@Lxg@Pnn@Vhy@Pnr@Jz]DvNN`q@XtnAP|q@T`n@Rvn@Zl~@Xfx@Rbt@PdzAT|s@@vILzc@?@T~o@Pr{@V~p@T~t@Rl{@Pzd@Pzt@Vly@DtUFtR@`GZlcATpy@Hje@Vr}@R~k@DhL?j@FrPPxg@Xha@v@pkA\\`t@[nSSxJQ|Ge@~RU~Kk@pYSbKUxLStFKnFOzJXpo@@\\@tKHjg@`@rxANhp@R~dARr_AFxV@zAJb[?rBXnkAF~UDhO??A@"
            )
        );
    });

    // Na 15 sekund fetcha pozicije vlakov + busov
    useEffect(() => {
        const fetchPositions = async () => {
            try {
                const [lpp, ijpp, trains] = await Promise.all([
                    fetchLPPPositions(),
                    fetchIJPPPositions(),
                    fetchTrainPositions(),
                ]);

                const lppPositions = Array.isArray(lpp) ? lpp : [];
                const ijppPositions = Array.isArray(ijpp) ? ijpp : [];
                const trainPositions = Array.isArray(trains) ? trains : [];

                setGpsPositions([...lppPositions, ...ijppPositions]);
                setTrainPositions(trainPositions);
            } catch (error) {
                console.error("Error fetching positions:", error);
            }
        };

        //začetn fetch
        fetchPositions();

        // fetchanje vsakih 5 sekund
        const intervalId = setInterval(fetchPositions, 5000);
        return () => clearInterval(intervalId);
    }, []);

    // Dobi userjevo lokacijo
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation([latitude, longitude]);
                    localStorage.setItem(
                        "userLocation",
                        JSON.stringify([latitude, longitude])
                    );
                },
                (error) => {
                    console.error("Error getting user's location:", error);
                }
            );
        } else {
            console.error("Geolocation is not supported by this browser.");
        }
    }, []);

    // LPP prihodi
    useEffect(() => {
        const load = async () => {
            const lppCode = activeStation?.ref_id || activeStation.station_code;
            if (!lppCode) {
                setLppArrivals([]);
                return;
            }
            try {
                const arrivals = await fetchLppArrivals(lppCode);
                setLppArrivals(arrivals);
            } catch (error) {
                console.error("Error loading LPP arrivals:", error);
                setLppArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // IJPP prihodi
    useEffect(() => {
        const load = async () => {
            const ijppId = activeStation?.gtfs_id;
            if (!ijppId) {
                setIjppArrivals([]);
                return;
            }
            try {
                const arrivals = await fetchIjppArrivals(ijppId);
                setIjppArrivals(arrivals);
            } catch (error) {
                console.error("Error loading IJPP arrivals:", error);
                setIjppArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // SZ prihodi
    useEffect(() => {
        const load = async () => {
            const szId = activeStation?.stopId;
            try {
                const arrivals = await fetchSzArrivals(szId);
                setSzArrivals(arrivals);
            } catch (error) {
                console.error("Error loading SZ arrivals:", error);
                setSzArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // LPP route
    useEffect(() => {
        const load = async () => {
            try {
                const route = await fetchLppRoute(
                    selectedVehicle.tripId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.tripId,

                    selectedVehicle.routeId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.routeId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.lineId
                );
                setLppRoute(route);
                console.log("Loaded LPP route:", route);
            } catch (error) {
                console.error("Error loading LPP route:", error);
            }
        };
        load();
    }, [selectedVehicle]);

    // Za fetchanje SZ tripov iz prihodov
    const getSzTripFromId = async (tripId) => {
        try {
            const route = await fetchSzTrip(tripId);
            setSzRoute(route ?? []);
            localStorage.setItem(
                "selectedBusRoute",
                JSON.stringify({
                    tripId: tripId,
                    tripName: route[0]?.tripName,
                    shortName: route[0]?.shortName,
                })
            );
        } catch (error) {
            console.error("Error loading SZ trip from ID:", error);
        }
    };

    // Dobi LPP routo iz prihodov (na isto foro kot SZ)
    const setLppRouteArrival = async (arrival) => {
        try {
            const route = await fetchLppRoute(arrival.tripId);
            setLppRoute(route);
            setSelectedVehicle({
                tripId: arrival.tripId,
                lineNumber: arrival.routeName,
                lineName: arrival.tripName,
                routeId: arrival.routeId,
                routeName: arrival.routeName,
                operator: "Javno podjetje Ljubljanski potniški promet d.o.o.",
            });
            localStorage.setItem(
                "selectedBusRoute",
                JSON.stringify({
                    tripId: arrival.tripId,
                    tripName: arrival.tripName,
                    routeName: arrival.routeName,
                    routeId: arrival.routeId,
                    operator:
                        "Javno podjetje Ljubljanski potniški promet d.o.o.",
                })
            );
        } catch (error) {
            console.error("Error loading LPP route:", error);
        }
    };

    // Dobi IJPP trip iz prihodov
    const setIjppRouteFromArrival = (arrival) => {
        if (!arrival?.tripId) return;
        const vehicle = {
            tripId: arrival.tripId,
            lineName: arrival.tripName,
            operator: arrival.operatorName,
        };
        setSelectedVehicle(vehicle);
        localStorage.setItem("selectedBusRoute", JSON.stringify(vehicle));
    };

    // Fetcha SZ routo
    useEffect(() => {
        const load = async () => {
            if (!selectedVehicle) return;
            try {
                const route = await fetchSzTrip(selectedVehicle.tripId);
                setSzRoute(route ?? []);
            } catch (error) {
                console.error("Error loading SZ route:", error);
                setSzRoute([]);
            }
        };
        load();
    }, [selectedVehicle]);

    // Fetcha IJPP pot
    useEffect(() => {
        if (!selectedVehicle) return;
        const isLPP = selectedVehicle?.lineNumber != null;
        const isSZ = Boolean(selectedVehicle?.from && selectedVehicle?.to);
        if (isLPP || isSZ) {
            setIjppTrip(null);
            return;
        }
        const tripId = selectedVehicle?.tripId;
        if (!tripId) {
            setIjppTrip(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const trip = await fetchIJPPTrip(tripId);
                if (!cancelled) setIjppTrip(trip);
            } catch (err) {
                if (!cancelled) setIjppTrip(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedVehicle]);

    return (
        <Router>
            <div className="container">
                <div className="content">
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    fontSize: "14px",
                                    color: "#94a3b8",
                                }}
                            >
                                Nalaganje...
                            </div>
                        }
                    >
                        <Routes>
                            <Route
                                path="/*"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        trainStops={szStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        trainPositions={trainPositions}
                                        setSelectedVehicle={setSelectedVehicle}
                                        ijppTrip={ijppTrip}
                                        lppRoute={lppRoute}
                                    />
                                }
                            />
                            <Route
                                path="/map"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        trainStops={szStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        trainPositions={trainPositions}
                                        setSelectedVehicle={setSelectedVehicle}
                                        ijppTrip={ijppTrip}
                                        lppRoute={lppRoute}
                                    />
                                }
                            />
                            <Route
                                path="/arrivals"
                                element={
                                    <ArrivalsTab
                                        activeStation={activeStation}
                                        ijppArrivals={ijppArrivals}
                                        lppArrivals={lppArrivals}
                                        szArrivals={szArrivals}
                                        getSzTripFromId={getSzTripFromId}
                                        setLppRouteFromArrival={
                                            setLppRouteArrival
                                        }
                                        setIjppRouteFromArrival={
                                            setIjppRouteFromArrival
                                        }
                                    />
                                }
                            />
                            <Route
                                path="/stations"
                                element={
                                    <NearMeTab
                                        setActiveStation={setActiveStation}
                                        busStops={busStops}
                                        szStops={szStops}
                                        userLocation={userLocation}
                                    />
                                }
                            />
                            <Route
                                path="/route"
                                element={
                                    <RouteTab
                                        selectedVehicle={selectedVehicle}
                                        lppRoute={lppRoute}
                                        szRoute={szRoute}
                                        ijppTrip={ijppTrip}
                                        setActiveStation={setActiveStation}
                                    />
                                }
                            />
                        </Routes>
                    </Suspense>
                </div>
                <nav>
                    <NavLink to="/map">
                        <button>
                            <Map size={24} />
                            <h3>Zemljevid</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/arrivals">
                        <button>
                            <Clock size={24} />
                            <h3>Prihodi</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/stations">
                        <button>
                            <MapPin size={24} />
                            <h3>V bližini</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/route">
                        <button>
                            <ArrowRightLeft size={24} />
                            <h3>Pot</h3>
                        </button>
                    </NavLink>
                </nav>
            </div>
        </Router>
    );
}

export default App;
