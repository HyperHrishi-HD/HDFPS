using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;
using Unity.Entities;
using Unity.NetCode;

namespace Unity.MP_FPS
{
    [RequireComponent(typeof(UIDocument))]
    public class InGameHUD : MonoBehaviour
    {
        [Header("Reticle Configuration")] [SerializeField]
        private float reticleBaseSize = 80f;

        private VisualElement m_RootElement;
        private ProgressBar m_HealthBar;
        private VisualElement m_PlayerHealthBarFill;
        private ProgressBar m_AmmoBar;
        private Label m_AmmoLabel;
        private Label m_WeaponLabel;
        private Label m_ReloadingLabel;
        private VisualElement m_Reticle;
        private VisualElement m_HitMarker;
        private VisualElement m_MobileControls;
        private Button m_MobileFireButton;
        private Button m_MobileJumpButton;
        private Button m_MobileReloadButton;
        private Button m_MobileSprintButton;

        private float m_shotFeedbackTimer = 0f;
        private const float k_ShotFeedbackDuration = 0.1f;
        private static readonly Color k_HealthBarColor = new Color(0.29f, 0.83f, 0.43f, 0.75f);
        private const string k_CrossReticleClass = "kits-reticle-cross";
        private const string k_TCrossReticleClass = "kits-reticle-tcross";
        private const string k_CircularCrossClass = "kits-reticle-circularcross";
        private const string k_OpenCircularReticleClass = "kits-reticle-opencircular";

        private World m_ClientWorld;
        private EntityManager m_EntityManager;
        private EntityQuery m_LocalPlayerQuery;
        private bool m_HasPlayerQuery;
        private bool m_MobileCallbacksBound;

        void OnEnable()
        {
            m_RootElement = GetComponent<UIDocument>().rootVisualElement;

            m_HealthBar = m_RootElement.Q<ProgressBar>("player-health-bar");
            if (m_HealthBar != null)
            {
                m_PlayerHealthBarFill = m_HealthBar.Q<VisualElement>(null, "unity-progress-bar__progress");
            }

            m_AmmoLabel = m_RootElement.Q<Label>("ammo-label");
            m_WeaponLabel = m_RootElement.Q<Label>("weapon-type-label");
            m_AmmoBar = m_RootElement.Q<ProgressBar>("player-ammo-bar");
            m_ReloadingLabel = m_RootElement.Q<Label>("reloading-label");
            m_Reticle = m_RootElement.Q<VisualElement>("player-reticle");
            m_HitMarker = m_RootElement.Q<VisualElement>("hit-marker");
            m_MobileControls = m_RootElement.Q<VisualElement>("mobile-controls");
            m_MobileFireButton = m_RootElement.Q<Button>("mobile-fire-button");
            m_MobileJumpButton = m_RootElement.Q<Button>("mobile-jump-button");
            m_MobileReloadButton = m_RootElement.Q<Button>("mobile-reload-button");
            m_MobileSprintButton = m_RootElement.Q<Button>("mobile-sprint-button");

            BindMobileControls();
        }

        void OnDisable()
        {
            UnbindMobileControls();
            GameplayInputState.MobileFireHeld = false;
            GameplayInputState.MobileJumpHeld = false;
            GameplayInputState.MobileSprintHeld = false;
        }

        private void BindMobileControls()
        {
            if (m_MobileCallbacksBound)
            {
                return;
            }

            BindHold(m_MobileFireButton, held => GameplayInputState.MobileFireHeld = held);
            BindHold(m_MobileJumpButton, held => GameplayInputState.MobileJumpHeld = held);
            BindHold(m_MobileSprintButton, held => GameplayInputState.MobileSprintHeld = held);
            if (m_MobileReloadButton != null)
            {
                m_MobileReloadButton.clicked += OnMobileReloadClicked;
            }

            m_MobileCallbacksBound = true;
        }

        private void UnbindMobileControls()
        {
            if (!m_MobileCallbacksBound)
            {
                return;
            }

            if (m_MobileReloadButton != null)
            {
                m_MobileReloadButton.clicked -= OnMobileReloadClicked;
            }

            m_MobileCallbacksBound = false;
        }

        private static void OnMobileReloadClicked()
        {
            GameplayInputState.MobileReloadPressed = true;
        }

        private static void BindHold(Button button, System.Action<bool> setter)
        {
            if (button == null)
            {
                return;
            }

            button.RegisterCallback<PointerDownEvent>(_ => setter(true));
            button.RegisterCallback<PointerUpEvent>(_ => setter(false));
            button.RegisterCallback<PointerLeaveEvent>(_ => setter(false));
            button.RegisterCallback<PointerCancelEvent>(_ => setter(false));
        }

        private void InitializeEcs()
        {
            m_ClientWorld = null;
            m_HasPlayerQuery = false;

            foreach (var world in World.All)
            {
                if (world.IsClient())
                {
                    m_ClientWorld = world;
                    m_EntityManager = world.EntityManager;
                    break;
                }
            }

            if (m_ClientWorld != null && m_ClientWorld.IsCreated)
            {
                m_LocalPlayerQuery = m_EntityManager.CreateEntityQuery(
                    ComponentType.ReadOnly<PredictedPlayerGhost>(),
                    ComponentType.ReadOnly<GhostOwnerIsLocal>()
                );
                m_HasPlayerQuery = true;
            }
        }

        void LateUpdate()
        {
            bool isInGame = GameSettings.Instance != null && GameSettings.Instance.GameState == GlobalGameState.InGame;
            if (m_RootElement.style.display != (isInGame ? DisplayStyle.Flex : DisplayStyle.None))
            {
                m_RootElement.style.display = isInGame ? DisplayStyle.Flex : DisplayStyle.None;
            }

            if (!isInGame) return;

            if (m_ClientWorld == null || !m_ClientWorld.IsCreated)
            {
                InitializeEcs();
            }

            if (!m_HasPlayerQuery || !m_LocalPlayerQuery.HasSingleton<PredictedPlayerGhost>())
            {
                m_RootElement.style.display = DisplayStyle.None;
                return;
            }

            PredictedPlayerGhost playerData = m_LocalPlayerQuery.GetSingleton<PredictedPlayerGhost>();

            if (m_HealthBar != null)
            {
                float maxHealth = playerData.MaxHealth > 0 ? playerData.MaxHealth : 100f;
                m_HealthBar.highValue = maxHealth;
                m_HealthBar.value = playerData.CurrentHealth;

                float healthPercent = Mathf.Clamp01(playerData.CurrentHealth / maxHealth);
                Color healthColor = Color.Lerp(Color.red, k_HealthBarColor, healthPercent);
                if (m_PlayerHealthBarFill != null)
                {
                    m_PlayerHealthBarFill.style.backgroundColor = healthColor;
                }
            }

            var weaponData = WeaponManager.Instance != null && WeaponManager.Instance.WeaponRegistry != null
                ? WeaponManager.Instance.WeaponRegistry.GetWeaponData(playerData.EquippedWeaponID)
                : null;
            int magazineSize = weaponData != null ? weaponData.MagazineSize : 0;

            if (m_WeaponLabel != null)
            {
                m_WeaponLabel.style.display = DisplayStyle.Flex;
                m_WeaponLabel.text = weaponData != null ? weaponData.WeaponName.ToUpperInvariant() : "UNARMED";
            }

            if (m_AmmoLabel != null)
            {
                m_AmmoLabel.text = $"{playerData.CurrentAmmo.ToString()} / {magazineSize.ToString()}";
                if (playerData.CurrentAmmo == 0) m_AmmoLabel.style.color = Color.red;
                else if (magazineSize > 0 && playerData.CurrentAmmo <= magazineSize * 0.3f) m_AmmoLabel.style.color = Color.yellow;
                else m_AmmoLabel.style.color = Color.white;

                if (m_AmmoBar != null)
                {
                    m_AmmoBar.highValue = magazineSize;
                    m_AmmoBar.value = playerData.CurrentAmmo;
                }
            }

            if (m_ReloadingLabel != null)
            {
                m_ReloadingLabel.style.display =
                    playerData.ControllerState.IsReloadingState ? DisplayStyle.Flex : DisplayStyle.None;
            }

            UpdateReticleVisual(playerData, weaponData);
            UpdateHitMarker();
            UpdateMobileControls();
        }

        private void UpdateHitMarker()
        {
            if (m_HitMarker == null)
            {
                return;
            }

            bool visible = GameplayInputState.HitConfirmTime > 0f;
            m_HitMarker.EnableInClassList("hit-marker--visible", visible);
            m_HitMarker.style.display = visible ? DisplayStyle.Flex : DisplayStyle.None;
        }

        private void UpdateMobileControls()
        {
            if (m_MobileControls == null)
            {
                return;
            }

            bool show = Touchscreen.current != null || Application.isMobilePlatform;
            m_MobileControls.EnableInClassList("mobile-controls--visible", show);
            m_MobileControls.style.display = show ? DisplayStyle.Flex : DisplayStyle.None;
        }

        private void UpdateReticleVisual(PredictedPlayerGhost playerData, WeaponData weaponData)
        {
            if (m_Reticle == null)
                return;

            if (m_shotFeedbackTimer > 0)
            {
                m_shotFeedbackTimer -= Time.deltaTime;
            }

            if (weaponData == null)
            {
                m_Reticle.style.display = DisplayStyle.None;
                return;
            }

            string desiredClass = GetReticleClassName(weaponData.ReticleType);

            if (desiredClass != k_CrossReticleClass) m_Reticle.RemoveFromClassList(k_CrossReticleClass);
            if (desiredClass != k_TCrossReticleClass) m_Reticle.RemoveFromClassList(k_TCrossReticleClass);
            if (desiredClass != k_OpenCircularReticleClass) m_Reticle.RemoveFromClassList(k_OpenCircularReticleClass);
            if (desiredClass != k_CircularCrossClass) m_Reticle.RemoveFromClassList(k_CircularCrossClass);

            if (!string.IsNullOrEmpty(desiredClass) && !m_Reticle.ClassListContains(desiredClass))
            {
                m_Reticle.AddToClassList(desiredClass);
            }

            if (m_Reticle.style.display == DisplayStyle.None)
            {
                m_Reticle.style.display = DisplayStyle.Flex;
            }

            m_Reticle.style.width = reticleBaseSize;
            m_Reticle.style.height = reticleBaseSize;

            bool isReloading = playerData.ControllerState.IsReloadingState;
            bool justFired = playerData.ControllerState.Shoot;
            bool isWeaponOnCooldown = playerData.WeaponCooldown < weaponData.CooldownInMs;

            if (justFired)
            {
                m_shotFeedbackTimer = k_ShotFeedbackDuration;
            }

            bool greyReticleVisual = isReloading || (isWeaponOnCooldown && m_shotFeedbackTimer <= 0);

            m_Reticle.style.unityBackgroundImageTintColor = greyReticleVisual
                ? new StyleColor(Color.grey)
                : new StyleColor(Color.white);
        }

        private string GetReticleClassName(ReticleType reticleType)
        {
            switch (reticleType)
            {
                case ReticleType.Cross: return k_CrossReticleClass;
                case ReticleType.TCross: return k_TCrossReticleClass;
                case ReticleType.OpenCircular: return k_OpenCircularReticleClass;
                case ReticleType.CircularCross: return k_CircularCrossClass;
                default: return "";
            }
        }
    }
}
