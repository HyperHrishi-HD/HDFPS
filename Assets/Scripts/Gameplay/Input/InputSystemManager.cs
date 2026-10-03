using Unity.MP_FPS;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Users;
using UnityEngine;

public class InputSystemManager : Singleton<InputSystemManager>
{
    protected override bool Persistent => true;

    private bool m_HasPairedInitialUserDevices;

    public static InputUser GetUserByIndex(int index)
    {
        Debug.Assert(index >= 0 && index < InputUser.all.Count);
        return InputUser.all[index];
    }

    public static InputUser GetUserById(uint id)
    {
        foreach (var user in InputUser.all)
        {
            if (user.id == id)
            {
                return user;
            }
        }

        Debug.LogError($"[InputSystemManager] requested invalid user id: {id}");
        return default;
    }

    public static InputUser GetFirstInputUser()
    {
        return TryGetFirstInputUser(out var user) ? user : default;
    }

    public static bool TryGetFirstInputUser(out InputUser user)
    {
        var allPlayers = InputUser.all;
        if (allPlayers.Count == 0)
        {
            user = default;
            return false;
        }

        user = allPlayers[0];
        return user.valid;
    }

    public static bool TryGetUserById(int id, out InputUser user)
    {
        foreach (var u in InputUser.all)
        {
            if (u.id == id)
            {
                user = u;
                return true;
            }
        }

        user = default;
        return false;
    }

    public override void Awake()
    {
        base.Awake();

        InputSystem.onDeviceChange += OnDeviceChange;

        PairInitialUsers();
    }

    public override void OnDestroy()
    {
        InputSystem.onDeviceChange -= OnDeviceChange;

        foreach (var user in InputUser.all)
        {
            var controls = (InputSystem_Actions)user.actions;
            controls.Disable();
        }

        base.OnDestroy();
    }


    private void OnDeviceChange(InputDevice device, InputDeviceChange change)
    {
        if (!Application.isPlaying)
        {
            return;
        }

        if (change == InputDeviceChange.Disconnected)
        {
            // placeholder
        }
        else if (change == InputDeviceChange.Reconnected)
        {
            // placeholder
        }
        else if (change == InputDeviceChange.Added)
        {
            // placeholder
            EnsureDevicePaired(device);
        }
        else if (change == InputDeviceChange.ConfigurationChanged)
        {
            // placeholder
            EnsureDevicePaired(device);
        }
    }

    private void EnsureDevicePaired(InputDevice device)
    {
        if (m_HasPairedInitialUserDevices
            && InputUser.GetUnpairedInputDevices().Contains(device))
        {
            if (TryFindUserWithLostDevice(device, out InputUser user))
            {
                Debug.Log($"[InputSystemManager]: Re-pairing device {device.name} user index {user.index}");
            }
            else
            {
                PairDeviceWithUser(device);
            }
        }
    }

    private InputUser PairDeviceWithUser(InputDevice device)
    {
        var user = InputUser.PerformPairingWithDevice(device);
        Debug.Log($"[InputSystemManager]: Pairing device {device.name} user index {user.index} id {user.id}");

        var gameControls = new InputSystem_Actions();
        gameControls.Enable();
        user.AssociateActionsWithUser(gameControls);

        var scheme = InputControlScheme.FindControlSchemeForDevice(device, gameControls.asset.controlSchemes);
        if (scheme.HasValue)
        {
            user.ActivateControlScheme(scheme.Value);
        }
        else
        {
            Debug.Log($"[InputSystemManager]: No control scheme is paired with device {device.name}");
        }

        return user;
    }

    private bool TryFindUserWithLostDevice(InputDevice desiredDevice, out InputUser existingUser)
    {
        foreach (var user in InputUser.all)
        {
            foreach (var device in user.lostDevices)
            {
                if (device == desiredDevice)
                {
                    existingUser = user;
                    return true;
                }
            }
        }

        existingUser = default;
        return false;
    }

    private void PairInitialUsers()
    {
        InputUser kbmUser = default;
        if (Keyboard.current != null)
        {
            kbmUser = PairDeviceWithUser(Keyboard.current);
        }

        if (Mouse.current != null)
        {
            if (kbmUser.valid)
            {
                InputUser.PerformPairingWithDevice(Mouse.current, kbmUser);
            }
            else
            {
                PairDeviceWithUser(Mouse.current);
            }
        }

        if (Gamepad.current != null)
        {
            PairDeviceWithUser(Gamepad.current);
        }

        if (Touchscreen.current != null)
        {
            PairDeviceWithUser(Touchscreen.current);
        }

        m_HasPairedInitialUserDevices = true;
    }
}