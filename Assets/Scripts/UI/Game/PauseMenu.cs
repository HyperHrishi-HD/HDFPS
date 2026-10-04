using Unity.Properties;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace Unity.MP_FPS
{
    [RequireComponent(typeof(UIDocument))]
    public class PauseMenu : MonoBehaviour
    {
        static class UIElementNames
        {
            public const string ResumeButton = "ResumeButton";
            public const string MainMenuButton = "MainMenuButton";
            public const string QuitButton = "QuitButton";
            public const string MouseSensitivitySlider = "MouseSensitivitySlider";
            public const string GamepadSensitivitySlider = "GamepadSensitivitySlider";
            public const string InvertYToggle = "InvertYToggle";
        }

        Button m_ResumeButton;
        Button m_MainMenuButton;
        Button m_QuitButton;
        Slider m_MouseSensitivitySlider;
        Slider m_GamepadSensitivitySlider;
        Toggle m_InvertYToggle;

        void OnEnable()
        {
            var root = GetComponent<UIDocument>().rootVisualElement;
            GameInput.Actions.UI.TogglePauseMenu.performed += TogglePauseMenuVisibility;

            root.SetBinding("style.display", new DataBinding
            {
                dataSource = GameSettings.Instance,
                dataSourcePath = new PropertyPath(GameSettings.PauseMenuStylePropertyName),
                bindingMode = BindingMode.ToTarget,
            });

            m_ResumeButton = root.Q<Button>(UIElementNames.ResumeButton);
            m_ResumeButton.clicked += OnResumePressed;

            m_MainMenuButton = root.Q<Button>(UIElementNames.MainMenuButton);
            m_MainMenuButton.clicked += OnMainMenuPressed;
            m_MainMenuButton.SetEnabled(GameManager.CanUseMainMenu);

            m_QuitButton = root.Q<Button>(UIElementNames.QuitButton);
            m_QuitButton.clicked += OnQuitPressed;

            m_MouseSensitivitySlider = root.Q<Slider>(UIElementNames.MouseSensitivitySlider);
            if (m_MouseSensitivitySlider != null)
            {
                m_MouseSensitivitySlider.SetValueWithoutNotify(GameSettings.Instance.MouseSensitivity);
                m_MouseSensitivitySlider.RegisterValueChangedCallback(OnMouseSensitivityChanged);
            }

            m_GamepadSensitivitySlider = root.Q<Slider>(UIElementNames.GamepadSensitivitySlider);
            if (m_GamepadSensitivitySlider != null)
            {
                m_GamepadSensitivitySlider.SetValueWithoutNotify(GameSettings.Instance.GamepadLookSensitivity);
                m_GamepadSensitivitySlider.RegisterValueChangedCallback(OnGamepadSensitivityChanged);
            }

            m_InvertYToggle = root.Q<Toggle>(UIElementNames.InvertYToggle);
            if (m_InvertYToggle != null)
            {
                m_InvertYToggle.SetValueWithoutNotify(GameSettings.Instance.InvertY);
                m_InvertYToggle.RegisterValueChangedCallback(OnInvertYChanged);
            }
        }

        void OnDisable()
        {
            if (GameInput.Actions != null)
            {
                GameInput.Actions.UI.TogglePauseMenu.performed -= TogglePauseMenuVisibility;
            }

            if (m_ResumeButton != null) m_ResumeButton.clicked -= OnResumePressed;
            if (m_MainMenuButton != null) m_MainMenuButton.clicked -= OnMainMenuPressed;
            if (m_QuitButton != null) m_QuitButton.clicked -= OnQuitPressed;
            if (m_MouseSensitivitySlider != null) m_MouseSensitivitySlider.UnregisterValueChangedCallback(OnMouseSensitivityChanged);
            if (m_GamepadSensitivitySlider != null) m_GamepadSensitivitySlider.UnregisterValueChangedCallback(OnGamepadSensitivityChanged);
            if (m_InvertYToggle != null) m_InvertYToggle.UnregisterValueChangedCallback(OnInvertYChanged);
        }

        void Update()
        {
            if (Gamepad.current != null && Gamepad.current.startButton.wasPressedThisFrame)
            {
                TogglePauseMenuVisibility(default);
            }
        }

        void TogglePauseMenuVisibility(InputAction.CallbackContext obj)
        {
            if (GameSettings.Instance == null || GameSettings.Instance.GameState != GlobalGameState.InGame)
            {
                return;
            }

            if (EventSystem.current != null && transform.parent != null)
            {
                var raycaster = transform.parent.GetComponentInChildren<PanelRaycaster>();
                if (raycaster != null)
                {
                    EventSystem.current.SetSelectedGameObject(raycaster.gameObject);
                }
            }

            GameSettings.Instance.IsPauseMenuOpen = !GameSettings.Instance.IsPauseMenuOpen;
        }

        static void OnResumePressed() => GameSettings.Instance.IsPauseMenuOpen = false;

        static void OnMainMenuPressed()
        {
            GameManager.Instance.ReturnToMainMenuAsync();
            Utils.SetCursorVisible(true);
        }

        static void OnQuitPressed() => GameManager.Instance.QuitAsync();

        static void OnMouseSensitivityChanged(ChangeEvent<float> evt)
        {
            GameSettings.Instance.MouseSensitivity = evt.newValue;
        }

        static void OnGamepadSensitivityChanged(ChangeEvent<float> evt)
        {
            GameSettings.Instance.GamepadLookSensitivity = evt.newValue;
        }

        static void OnInvertYChanged(ChangeEvent<bool> evt)
        {
            GameSettings.Instance.InvertY = evt.newValue;
        }
    }
}
