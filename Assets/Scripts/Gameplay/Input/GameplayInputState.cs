using Unity.Mathematics;
using UnityEngine;

namespace Unity.MP_FPS
{
    /// <summary>
    /// Shared, frame-local gameplay input extras that are not part of the networked command stream.
    /// Used for look recoil, hit confirmation, and on-screen mobile controls.
    /// </summary>
    public static class GameplayInputState
    {
        public static float2 RecoilKickDegrees;
        public static bool MobileFireHeld;
        public static bool MobileJumpHeld;
        public static bool MobileReloadPressed;
        public static bool MobileSprintHeld;
        public static float HitConfirmTime;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void Reset()
        {
            RecoilKickDegrees = float2.zero;
            MobileFireHeld = false;
            MobileJumpHeld = false;
            MobileReloadPressed = false;
            MobileSprintHeld = false;
            HitConfirmTime = 0f;
        }

        public static bool ShouldBlockGameplayInput()
        {
            if (GameSettings.Instance == null)
            {
                return true;
            }

            if (GameSettings.Instance.GameState != GlobalGameState.InGame)
            {
                return true;
            }

            return GameSettings.Instance.IsPauseMenuOpen;
        }

        public static void AddRecoil(float pitchDegrees, float yawDegrees)
        {
            RecoilKickDegrees += new float2(yawDegrees, pitchDegrees);
        }

        public static float2 ConsumeRecoil()
        {
            var kick = RecoilKickDegrees;
            RecoilKickDegrees = float2.zero;
            return kick;
        }

        public static void NotifyHit()
        {
            HitConfirmTime = 0.12f;
        }

        public static void Tick(float deltaTime)
        {
            if (HitConfirmTime > 0f)
            {
                HitConfirmTime = math.max(0f, HitConfirmTime - deltaTime);
            }
        }
    }
}
